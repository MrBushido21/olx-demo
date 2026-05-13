# OLX Clone — Project Documentation

## Overview

NestJS monorepo with microservice architecture. Services communicate via **RabbitMQ**, each stores data in its own **PostgreSQL** database. Images are stored in **Cloudinary**.

---

## Architecture

```
Auth (3000) ──RPC──► Users (3002) ──Event──► Listings (3001)
               auth_queue            users_queue
                                                    │ RPC
                                                    ▼
                                             Chats (3003)
                                           listings_queue
```

| Service  | Port | Listens on queue  | Database          |
|----------|------|-------------------|-------------------|
| Auth     | 3000 | —                 | `nestdb`          |
| Users    | 3002 | `auth_queue`      | `users_nestdb`    |
| Listings | 3001 | `users_queue`     | `listings_nestdb` |
| Chats    | 3003 | `listings_queue`  | `chats_nestdb`    |

---

## Services

### Auth (port 3000)

Registration, login, JWT tokens, password reset.

**Endpoints:**

| Method | Path                    | Auth | Description                                          |
|--------|-------------------------|------|------------------------------------------------------|
| POST   | `/auth/register-link`   | No   | Generate email verification link                     |
| POST   | `/auth/register`        | No   | Register user by verification token                  |
| POST   | `/auth/login`           | No   | Login, returns access_token + sets refresh cookie    |
| POST   | `/auth/refresh`         | No   | Issue new access_token using refresh_token cookie    |
| POST   | `/auth/reset`           | No   | Generate password reset link                         |
| POST   | `/auth/changepassword`  | No   | Change password by reset token                       |
| DELETE | `/auth/logout`          | No   | Logout, deletes refresh token, clears cookie         |
| POST   | `/auth/test`            | No   | **TEST ONLY** — create user + listing, return token  |

**Token flow:**
- `access_token` — JWT, expires in 1 hour, returned in response body
- `refresh_token` — JWT, expires in 7 days, stored in `httpOnly` cookie and in DB
- `POST /auth/refresh` — reads cookie, verifies against DB, issues new pair

**Email sending (MVP stub):**
> `POST /auth/register-link` and `POST /auth/reset` currently return the link as a string in the response body.
> The email sending code is written but commented out in `auth.service.ts`.
> To enable: install `nodemailer`, add SMTP env vars, uncomment the `sendEmail` calls.

**RabbitMQ — sends to Users via `auth_queue`:**

| Pattern             | Description              |
|---------------------|--------------------------|
| `user.created`      | Create user              |
| `user.findByEmail`  | Find user by email       |
| `user.findById`     | Find user by ID          |
| `user.updatePass`   | Update password          |

**Entities:**
- `UserRefreshTokens` — refresh tokens
- `UserVerifyCodes` — email verification tokens
- `UserResetTokens` — password reset tokens

---

### Users (port 3002)

User profiles, favorites, avatar upload.

**Endpoints:**

| Method | Path                     | Auth | Description                                          |
|--------|--------------------------|------|------------------------------------------------------|
| GET    | `/users/me`              | Yes  | Get current user profile                             |
| GET    | `/users/:id`             | No   | Get public seller profile (id, username, location, avatar, created_at) |
| GET    | `/users/me/chats`        | Yes  | Get user chats (`?type=buyer\|seller`)               |
| GET    | `/users/favorites`       | Yes  | Get all favorited listings (with images)             |
| POST   | `/users/like`            | Yes  | Toggle listing favorite (add / remove)               |
| PATCH  | `/users/changeuserinfo`  | Yes  | Update profile + upload avatar (`multipart/form-data`, field `avatar`) |

**PATCH `/users/changeuserinfo` body:**
- `username` — new display name
- `location` — location string
- `phone` — phone number
- `avatar` — image file (optional, `multipart/form-data`)

> If a new avatar is uploaded and the user already has one, the old image is deleted from Cloudinary before uploading the new one.

**RabbitMQ — receives from Auth via `auth_queue`:**

| Pattern             | Description              |
|---------------------|--------------------------|
| `user.created`      | Create user              |
| `user.findByEmail`  | Find user by email       |
| `user.findById`     | Find user by ID          |
| `user.updatePass`   | Update password          |

**RabbitMQ — sends to Listings via `users_queue`:**

| Pattern / Event          | Type  | Description                                        |
|--------------------------|-------|----------------------------------------------------|
| `listing.updateLike`     | emit  | Increment / decrement likes counter                |
| `listing.get.favorites`  | send  | Get listings by array of IDs (returns with images) |

**Entities:**
- `Users` — id, username, email, password, role, status, phone, location, avatar_url, avatar_public_id, created_at
- `FavoritesEntity` — id, listingId, userId (FK → Users CASCADE), created_at

---

### Listings (port 3001)

CRUD listings, image management, search, categories.

**Endpoints:**

| Method | Path                        | Auth | Description                                          |
|--------|-----------------------------|------|------------------------------------------------------|
| GET    | `/listings`                 | No   | Browse all active listings (pagination, filters)     |
| GET    | `/listings/my`              | Yes  | Current user's own listings (supports hidden filter) |
| GET    | `/listings/my-categories`   | Yes  | Unique categories of current user's listings         |
| GET    | `/listings/:id`             | No   | Single listing (increments `views`)                  |
| POST   | `/listings/create`          | Yes  | Create listing + upload images                       |
| POST   | `/listings/match-categories`| No   | Suggest category by listing title                    |
| POST   | `/listings/images-edit`     | Yes  | Add / update / delete listing image                  |
| POST   | `/listings/:id/chat`        | Yes  | Send first message to seller (creates chat)          |
| POST   | `/listings/:id/report`      | Yes  | Report a listing (reason must be a valid value)      |
| POST   | `/listings/:id/review`      | Yes  | Leave a review (one per user, cannot review own listing) |
| PUT    | `/listings/:id`             | Yes  | Update listing text content                          |
| PUT    | `/listings/activate/:id`    | Yes  | Re-activate a hidden listing                         |
| PATCH  | `/listings/hidden/:id`      | Yes  | Hide a listing                                       |
| DELETE | `/listings/:id`             | Yes  | Delete listing                                       |

**Query params for `GET /listings` and `GET /listings/my`:**
- `page` — page number (20 per page)
- `category` — filter by category
- `sorted` — `abc` | `created` | `price`
- `order` — `ASC` | `DESC`
- `query` — full-text search (pg_trgm similarity > 0.2)
- `priceMin` — minimum price (filters on `listing_atributes->>'price'`)
- `priceMax` — maximum price
- `hidden` — (`/listings/my` only) if present, returns hidden listings instead of active

**POST `/listings/create`** — `multipart/form-data`, field `images` (up to 5 files). Listing expires in 30 days.

**POST `/listings/images-edit`** — `multipart/form-data`:
- `action` — `"add"` | `"update"` | `"delete"`
- `listingId` — listing id
- `imageId` — image id (required for `update` and `delete`)
- `images` — files (required for `add` and `update`)

**RabbitMQ — sends to Chats via `listings_queue`:**

| Pattern        | Description                              |
|----------------|------------------------------------------|
| `chat.created` | Create chat + save first message         |

**RabbitMQ — receives from Users via `users_queue`:**

| Pattern / Event          | Type          | Description                                        |
|--------------------------|---------------|----------------------------------------------------|
| `listing.updateLike`     | EventPattern  | Increment / decrement `likes` field                |
| `listing.get.favorites`  | MessagePattern| Return listings by array of IDs (with images)      |

**Listing expiry:** cron job runs daily at midnight, deactivates listings where `expired_at < NOW()` (sets `active = 'hidden'`). Listings expire 30 days after creation.

**Valid report reasons:** `Мошенничество`, `Неправдивые данные о товаре`, `Кража обьявления`

**Entities:**
- `Listings` — id, userId, listing_title, listing_decription, listing_location, listing_username, listing_category, listing_atributes (JSONB), active (`active`/`hidden`), listing_phone, views, likes, chates, created_at, expired_at
- `ListingImages` — id, imageUrl, imageKey, listingId (FK → Listings CASCADE)
- `ReportEntity` — id, listingId, userId, reason, created_at
- `ReviewEntity` — id, review, userId, listingId (FK → Listings CASCADE), created_at

---

### Chats (port 3003)

Real-time chat between buyer and seller. First message is created via HTTP (from Listings service). Subsequent messages go through WebSocket.

**WebSocket Gateway (same port 3003):**

Connect by passing `token: Bearer {access_token}` in handshake headers. Invalid or expired token disconnects the client immediately.

| Event (client → server) | Body                   | Description                                                              |
|-------------------------|------------------------|--------------------------------------------------------------------------|
| `joinRoom`              | `{ chatId: string }`   | Join chat room. Verifies userId is a participant. Resets unread counter for current user. Emits `history` with last 50 messages |
| `sendMessage`           | `{ content: string, imageId?: string }` | Send message. Only works after `joinRoom`. Empty messages ignored |
| `getMessage`            | —                      | Re-fetch message history for current room                                |

| Event (server → client) | Description                                          |
|-------------------------|------------------------------------------------------|
| `history`               | Array of last 50 messages (ASC by date)              |
| `newMessage`            | New message broadcast to all room participants       |
| `error`                 | Auth or access error                                 |

**HTTP endpoints:**

| Method | Path            | Auth | Description                                                      |
|--------|-----------------|------|------------------------------------------------------------------|
| POST   | `/chats/upload` | Yes  | Upload image to chat (`multipart/form-data`, field `image`, body: `chatId`) |

**RabbitMQ — receives from Listings via `listings_queue`:**

| Pattern       | Description                                                        |
|---------------|--------------------------------------------------------------------|
| `chat.created`| Create chat (or find existing) + save first message               |
| `chats.users` | Return user's chats by type (`buyer` / `seller`)                  |

**Unread messages:** `buyerUnread` and `sellerUnread` are tracked separately per chat. On `sendMessage` the recipient's counter increments if they are not currently in the room. On `joinRoom` the current user's counter resets to 0. `GET /users/me/chats` returns the correct `unread` field for the requesting user.

**Entities:**
- `ChatsEntity` — id, listingId, buyerId, sellerId, buyerUnread, sellerUnread, created_at. Unique constraint on `(buyerId, sellerId, listingId)`
- `MessageEntity` — id, userId, content, url, public_id, chatId (FK → ChatsEntity CASCADE), created_at

---

## Shared Library (`libs/common`)

| Export                                         | Description                                                  |
|------------------------------------------------|--------------------------------------------------------------|
| `mainstart(env, module, route, port, queue?)`  | Start service: HTTP + optional RabbitMQ microservice         |
| `getUserId(req)`                               | Extract userId from JWT payload, throws 401 if missing       |
| `getExpiredAt(days)`                           | Returns Date N days from now                                 |
| `CheckAuthMiddleware`                          | Validates `Authorization: Bearer {token}`, attaches `req.user` |
| `envcheker()`                                  | Validates all required env vars at startup                   |
| `TypeOrmModuleConf`                            | TypeORM config factory                                       |
| `CloudinaryProvider`                           | Cloudinary NestJS provider                                   |

---

## Cloudinary

Used for storing listing images and user avatars.

| Variable                 | Description     |
|--------------------------|-----------------|
| `CLOUDINARY_CLOUD_NAME`  | Cloud name      |
| `CLOUDINARY_API_KEY`     | API key         |
| `CLOUDINARY_API_SECRET`  | API secret      |

**Behavior:**
- Uploading a new avatar automatically deletes the old one from Cloudinary
- Updating or deleting a listing image removes the old file from Cloudinary
- Images are uploaded via `uploadImageToCloudinary` / `uploadImages` (batch), deleted via `deleteImageFromCloudinary`

---

## Databases

| Database           | Service  | Notes                         |
|--------------------|----------|-------------------------------|
| `nestdb`           | Auth     | —                             |
| `users_nestdb`     | Users    | —                             |
| `listings_nestdb`  | Listings | requires `pg_trgm` extension  |
| `chats_nestdb`     | Chats    | —                             |

---

## RabbitMQ

- All queues are **durable**
- AMQP port: 5672 / Management UI: 15672
- Credentials from env: `RABBITMQ_USER` / `RABBITMQ_PASSWORD`
- Management UI: `http://localhost:15672`

---

## Environment Variables

```env
AUTH_PORT=3000
LISTINGS_PORT=3001
USERS_PORT=3002
CHATS_PORT=3003

POSTGRES_USER=oleg
POSTGRES_PASSWORD=nestpass
DB_HOST=localhost
DB_PORT=5432

AUTH_POSTGRES_DB=nestdb
LISTINGS_POSTGRES_DB=listings_nestdb
USERS_POSTGRES_DB=users_nestdb
CHATS_POSTGRES_DB=chats_nestdb

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin

BASE_URL=http://localhost:3000/

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Email (disabled in MVP — see auth.service.ts for implementation)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your@email.com
# SMTP_PASS=your_app_password
```

---

## Swagger

- Auth: `http://localhost:3000/auth-api`
- Users: `http://localhost:3002/users-api`
- Listings: `http://localhost:3001/listings-api`
- Chats: no Swagger (WebSocket only)

---

## Running the Project

```bash
# Infrastructure only (PostgreSQL + RabbitMQ)
docker-compose up postgres rabbitmq -d

# All services via Docker (production-like)
docker-compose up --build

# Individual services in development (hot reload)
npm run start:auth
npm run start:users
npm run start:listings
npm run start:chats

# Rebuild all services
npm run build:auth && npm run build:users && npm run build:listings && npm run build:chats

# Recreate volumes (after schema changes)
docker-compose down -v && docker-compose up -d
```

---

## Known gaps

| Feature | Notes |
|---|---|
| Email sending | Stub commented in `auth.service.ts`. Needs nodemailer + SMTP env vars to enable |
| Seller rating score | Reviews exist (`ReviewEntity`) but no aggregated average rating calculation |
| Push / email notifications | No alerts when a message arrives or a listing gets a like |
