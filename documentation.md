# OLX-clone — Документация проекта

## Обзор

NestJS монорепозиторий с микросервисной архитектурой. Сервисы общаются через **RabbitMQ**, хранят данные в **PostgreSQL** (отдельная БД на сервис). Изображения хранятся в **Cloudinary**.

---

## Архитектура

```
Auth (3000) ──RPC──► Users (3002) ──Event──► Listings (3001)
               auth_queue            users_queue
```

| Сервис | Порт | Слушает очередь | БД |
|--------|------|----------------|----|
| Auth | 3000 | — | `nestdb` |
| Users | 3002 | `auth_queue` | `users_nestdb` |
| Listings | 3001 | `users_queue` | `listings_nestdb` |

---

## Сервисы

### Auth (порт 3000)

Регистрация, логин, JWT токены, сброс пароля.

**Эндпоинты:**

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/register-link` | Отправить ссылку верификации email |
| POST | `/auth/register` | Зарегистрировать пользователя по токену |
| POST | `/auth/login` | Вход |
| POST | `/auth/reset` | Ссылка для сброса пароля |
| POST | `/auth/changepassword` | Сменить пароль по токену |
| DELETE | `/auth/logout` | Выход (удаляет refresh token) |

**RabbitMQ (отправляет → Users):**

| Паттерн | Описание |
|---------|----------|
| `user.created` | Создать пользователя |
| `user.findByEmail` | Найти по email |
| `user.findById` | Найти по ID |
| `user.updatePass` | Обновить пароль |
| `user.updateUserInfo` | Обновить данные |

**Сущности:**
- `UserRefreshTokens` — refresh токены
- `UserVerifyCodes` — токены верификации email
- `UserResetTokens` — токены сброса пароля

---

### Users (порт 3002)

Профили пользователей, избранное, загрузка аватара.

**Эндпоинты:**

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/users/like` | Да | Добавить/убрать из избранного |
| PATCH | `/users/changeuserinfo` | Да | Обновить профиль + загрузить аватар (`multipart/form-data`, поле `avatar`) |

**PATCH `/users/changeuserinfo` — тело запроса:**
- `username` — новое имя
- `location` — местоположение
- `phone` — телефон
- `avatar` — файл изображения (опционально, `multipart/form-data`)

> При наличии `avatar`: если у пользователя уже был аватар — старый удаляется из Cloudinary и заменяется новым.

**RabbitMQ (принимает от Auth через `auth_queue`):**

| Паттерн | Описание |
|---------|----------|
| `user.created` | Создать пользователя |
| `user.findByEmail` | Найти по email |
| `user.findById` | Найти по ID |
| `user.updatePass` | Обновить пароль |
| `user.updateUserInfo` | Обновить данные |

**RabbitMQ (отправляет → Listings через `users_queue`):**

| Событие | Описание |
|---------|----------|
| `listing.updateLike` | Обновить счётчик лайков (increment/decrement) |

**Сущности:**
- `Users` — id, username, email, password, role, status, phone, location, avatar_url, avatar_public_id, created_at
- `FavoritesEntity` — id, listingId, userId (FK → Users CASCADE), created_at

---

### Listings (порт 3001)

CRUD объявлений, управление изображениями, поиск, категории.

**Эндпоинты:**

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/listings/my-categories` | Да | Уникальные категории объявлений пользователя |
| GET | `/listings/my` | Да | Объявления пользователя (пагинация, фильтры) |
| GET | `/listings/:id` | Нет | Одно объявление (увеличивает `views`) |
| POST | `/listings/create` | Да | Создать объявление + загрузить изображения |
| POST | `/listings/match-categories` | Нет | Подобрать категорию по заголовку |
| POST | `/listings/images-edit` | Да | Добавить / обновить / удалить изображение объявления |
| PUT | `/listings/:id` | Да | Обновить текстовую часть объявления |
| PATCH | `/listings/hidden/:id` | Да | Скрыть объявление |
| PUT | `/listings/activate/:id` | Да | Активировать скрытое объявление |
| DELETE | `/listings/:id` | Да | Удалить объявление |

**Query параметры GET `/listings/my`:**
- `page` — страница (20 на страницу)
- `category` — фильтр по категории
- `sorted` — `abc` | `created` | `price`
- `order` — `ASC` | `DESC`
- `query` — полнотекстовый поиск (pg_trgm similarity > 0.2)
- `hidden` — если передан (любое значение) — вернуть скрытые объявления

**POST `/listings/create`** — `multipart/form-data`, поле `images` (до 5 файлов). Объявление создаётся со сроком 30 дней.

**POST `/listings/images-edit`** — `multipart/form-data`:
- `action` — `"add"` | `"update"` | `"delete"`
- `listingId` — id объявления
- `imageId` — id изображения (нужен для `update` и `delete`)
- `images` — файлы (нужны для `add` и `update`)

**RabbitMQ (принимает от Users через `users_queue`):**

| Событие | Описание |
|---------|----------|
| `listing.updateLike` | Инкремент/декремент поля `likes` |

**Сущности:**
- `Listings` — id, userId, listing_title, listing_decription, listing_location, listing_username, listing_category, listing_atributes (JSONB), active (`active`/`hidden`), listing_phone, views (default 0), likes (default 0), chates (default 0), created_at, expired_at
- `ListingImages` — id, imageUrl, imageKey, listingId (FK → Listings CASCADE)

---

## Cloudinary

Используется для хранения изображений объявлений и аватаров пользователей.

| Переменная | Описание |
|-----------|----------|
| `CLOUDINARY_CLOUD_NAME` | Имя облака |
| `CLOUDINARY_API_KEY` | API ключ |
| `CLOUDINARY_API_SECRET` | API секрет |

**Поведение:**
- При загрузке нового аватара старый автоматически удаляется из Cloudinary
- При удалении/обновлении изображения объявления старый файл удаляется из Cloudinary
- Изображения загружаются через `uploadImageToCloudinary` / `uploadImages` (batch), удаляются через `deleteImageFromCloudinary`

---

## Общая библиотека (libs/common)

- **`mainstart(env, module, route, port, rmqQueue?)`** — запуск сервиса (HTTP + опционально микросервис)
- **`getUserId(req)`** — извлечь userId из JWT (кидает 401 если нет)
- **`getExpiredAt(days)`** — дата истечения через N дней
- **`CheckAuthMiddleware`** — проверка `Authorization: Bearer {token}`, добавляет `req.user`
- **`env.checker`** — валидация переменных окружения
- **`TypeOrmModule.conf`** — фабрика конфига TypeORM

---

## Базы данных

| БД | Сервис | Особенности |
|----|--------|-------------|
| `nestdb` | Auth | — |
| `users_nestdb` | Users | — |
| `listings_nestdb` | Listings | расширение `pg_trgm` |

---

## RabbitMQ

- Все очереди **durable**
- Порт AMQP: 5672 / UI: 15672
- Credentials: `admin / admin`

---

## Переменные окружения

```env
AUTH_PORT=3000
LISTINGS_PORT=3001
USERS_PORT=3002

POSTGRES_USER=oleg
POSTGRES_PASSWORD=nestpass
DB_HOST=localhost
DB_PORT=5432

AUTH_POSTGRES_DB=nestdb
LISTINGS_POSTGRES_DB=listings_nestdb
USERS_POSTGRES_DB=users_nestdb

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

RABBITMQ_URL=amqp://admin:admin@localhost:5672
BASE_URL=http://localhost:3000/

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Swagger

- Auth: `http://localhost:3000/auth-api`
- Users: `http://localhost:3002/users-api`
- Listings: `http://localhost:3001/listings-api`

---

## Запуск

```bash
# Инфраструктура (PostgreSQL + RabbitMQ)
docker-compose up -d

# Пересоздать volumes (при изменении схемы БД)
docker-compose down -v && docker-compose up -d

# Разработка
npm run start:dev

# Продакшн
npm run build && npm run start:prod
```

---

## Что не реализовано

- **Refresh token** — нет эндпоинта `POST /auth/refresh` для обновления access_token. При истечении (1ч) пользователь должен логиниться заново
- **GET /auth/me** — нет эндпоинта для получения данных текущего пользователя
- **Chat** — поле `chates` в `Listings` есть, но сервис чата не реализован
