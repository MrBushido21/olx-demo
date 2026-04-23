# OLX-clone — Документация проекта

## Обзор

NestJS монорепозиторий с микросервисной архитектурой. Сервисы общаются через **RabbitMQ**, хранят данные в **PostgreSQL** (отдельная БД на сервис). Изображения хранятся в **Cloudinary**.

---

## Архитектура

```
Auth (3000) ──RPC──► Users (3002) ──Event──► Listings (3001)
               auth_queue            users_queue
                                                    │ Event
                                                    ▼
                                             Chats (3003)
                                           listings_queue
```

| Сервис | Порт | Слушает очередь | БД |
|--------|------|----------------|----|
| Auth | 3000 | — | `nestdb` |
| Users | 3002 | `auth_queue` | `users_nestdb` |
| Listings | 3001 | `users_queue` | `listings_nestdb` |
| Chats | 3003 | `listings_queue` | `chats_nestdb` |

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
| POST | `/auth/test` | **Только для тестов** — создать юзера + объявление, вернуть `access_token` |

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
| GET | `/users/me` | Да | Получить данные текущего пользователя |
| GET | `/users/me/chats` | Да | Получить чаты пользователя (query: `type=buyer\|seller`) |
| GET | `/users/favorites` | Да | Получить все избранные объявления пользователя (с изображениями) |
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

| Паттерн/Событие | Тип | Описание |
|---------|-----|----------|
| `listing.updateLike` | emit | Обновить счётчик лайков (increment/decrement) |
| `listing.get.favorites` | send | Получить объявления по массиву ID (возвращает с изображениями) |

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

**POST `/listings/:id/chat`** — написать продавцу по объявлению. Тело: `{ message: string }`. Создаёт чат (если не существует) и сохраняет первое сообщение. Требует авторизации покупателя.

**RabbitMQ (отправляет → Chats через `listings_queue`):**

| Паттерн | Описание |
|---------|----------|
| `chat.created` | Создать чат + сохранить первое сообщение |

**RabbitMQ (принимает от Users через `users_queue`):**

| Паттерн/Событие | Тип | Описание |
|---------|-----|----------|
| `listing.updateLike` | EventPattern | Инкремент/декремент поля `likes` |
| `listing.get.favorites` | MessagePattern | Вернуть объявления по массиву ID (с images relation) |

**Сущности:**
- `Listings` — id, userId, listing_title, listing_decription, listing_location, listing_username, listing_category, listing_atributes (JSONB), active (`active`/`hidden`), listing_phone, views (default 0), likes (default 0), chates (default 0), created_at, expired_at
- `ListingImages` — id, imageUrl, imageKey, listingId (FK → Listings CASCADE)

---

### Chats (порт 3003)

Чат между покупателем и продавцом. Первое сообщение создаётся через HTTP (от Listings), дальнейшее общение — через WebSocket.

**WebSocket Gateway (тот же порт 3003):**

Подключение: передать `token: Bearer {access_token}` в заголовках handshake. При невалидном токене — соединение немедленно дропается.

| Событие (клиент → сервер) | Тело | Описание |
|--------------------------|------|----------|
| `joinRoom` | `{ chatId: string }` | Войти в комнату чата. Проверяет что userId — участник чата. Возвращает событие `history` с последними 50 сообщениями |
| `sendMessage` | `{ content: string }` | Отправить сообщение. Работает только после `joinRoom`. Пустые сообщения игнорируются |
| `getMessage` | — | Повторно получить историю сообщений текущей комнаты |

| Событие (сервер → клиент) | Описание |
|--------------------------|----------|
| `history` | Массив последних 50 сообщений чата (ASC по дате) |
| `newMessage` | Новое сообщение в комнате (рассылается всем участникам) |
| `error` | Ошибка авторизации или доступа |

**HTTP эндпоинты:**

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/chats/upload` | Да | Загрузить изображение в чат (`multipart/form-data`, поле `image`, тело: `chatId`) |

**RabbitMQ (принимает от Listings через `listings_queue`):**

| Паттерн | Описание |
|---------|----------|
| `chat.created` | Создать чат (или найти существующий) + сохранить первое сообщение |
| `chats.users` | Вернуть чаты пользователя по типу (`buyer` / `seller`) |

**Сущности:**
- `ChatsEntity` — id, listingId, buyerId, sellerId, created_at. Уникальный constraint на `(buyerId, sellerId, listingId)`
- `MessageEntity` — id, userId, content, chatId (FK → ChatsEntity CASCADE), created_at

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
| `chats_nestdb` | Chats | — |

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
- Chats: нет Swagger (только WebSocket)

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
- **GET /auth/me** — нет эндпоинта для получения данных текущего пользователя через auth сервис (есть `GET /users/me`)
