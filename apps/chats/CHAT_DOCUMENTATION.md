# Chat Module — WebSocket документация

## Обзор

В этом документе описано как построить приватный чат в реальном времени между **покупателем** и **продавцом** в контексте **объявления**. Каждый диалог привязан к уникальной комнате `listingId + buyerId`, чтобы продавец мог вести отдельные переписки с несколькими покупателями по одному объявлению.

**Стек проекта:**
- NestJS 11 + `@nestjs/websockets` + `@nestjs/platform-socket.io`
- Socket.IO v4
- TypeORM + PostgreSQL
- JWT (те же токены, которые выдаёт `auth` сервис)

---

## Архитектура

```
Клиент A (покупатель) ──┐
                        ├──► WebSocket Gateway (namespace: /chats)
Клиент B (продавец)  ──┘             │
                                     ▼
                           ChatsService (бизнес-логика)
                                     │
                                     ▼
                           PostgreSQL (Chat + Message entities)
```

- При `connection` — сервер проверяет JWT из хендшейка, отключает неавторизованных клиентов.
- При `joinRoom` — оба участника входят в одну Socket.IO комнату (`room:<listingId>:<buyerId>`).
- При `sendMessage` — сообщение сохраняется в БД и рассылается только участникам комнаты.
- При `getHistory` — сервер возвращает историю сообщений с пагинацией.

---

## Шаг 1 — Сущности базы данных

Создай два файла в папке `apps/chats/entities/`.

### `apps/chats/entities/chat.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Объявление, к которому относится чат
  @Column()
  listingId!: string;

  // Покупатель — тот кто начал чат
  @Column()
  buyerId!: string;

  // Продавец — владелец объявления
  @Column()
  sellerId!: string;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => Message, (message) => message.chat, { cascade: true })
  messages!: Message[];
}
```

### `apps/chats/entities/message.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chat } from './chat.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  chatId!: string;

  // ID пользователя, который отправил сообщение
  @Column()
  senderId!: string;

  @Column('text')
  content!: string;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;
}
```

---

## Шаг 2 — Обновляем ChatsModule

Регистрируем сущности и подключаем gateway.

### `apps/chats/src/chats.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatGateway } from './events/chat.gateway';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Каждый микросервис в монорепо имеет свою БД.
    // Добавь CHATS_POSTGRES_DB в .env (см. Шаг 3).
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('CHATS_POSTGRES_DB'),
        entities: [Chat, Message],
        synchronize: true, // в продакшене использовать миграции
      }),
    }),
    TypeOrmModule.forFeature([Chat, Message]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatGateway],
})
export class ChatsModule {}
```

---

## Шаг 3 — Переменные окружения

Добавь в `.env`:

```env
CHATS_POSTGRES_DB=postgres://user:password@localhost:5432/chats_db
CHATS_PORT=3003
JWT_ACCESS_SECRET=твой_jwt_секрет   # то же значение что и в auth сервисе
```

---

## Шаг 4 — Авторизация WebSocket через Guard

**Почему не Middleware?**

`CheckAuthMiddleware` который используется в `auth` и `users` сервисах — это `NestMiddleware`. Он перехватывает только HTTP запросы. WebSocket соединение устанавливается через хендшейк (однократный HTTP Upgrade запрос), после чего живёт вне HTTP — middleware его не увидит.

**Правильный NestJS способ** — это `Guard` (`CanActivate`). Guards работают и с HTTP и с WebSocket одинаково. Принцип тот же что у твоего `CheckAuthMiddleware`: проверяем JWT, кладём пользователя в контекст, блокируем если невалидно.

Создай файл `apps/chats/src/guards/ws-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Получаем WebSocket клиента из контекста (аналог req в HTTP)
    const client: Socket = context.switchToWs().getClient();

    try {
      const raw: string = client.handshake.auth?.token ?? '';

      if (!raw.startsWith('Bearer ')) {
        client.emit('error', { message: 'Отсутствует токен авторизации' });
        client.disconnect();
        return false;
      }

      const token = raw.split(' ')[1];
      const secret = process.env.JWT_ACCESS_SECRET ?? '';
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;

      // Сохраняем пользователя в socket.data — аналог req.user в HTTP
      client.data.user = { id: payload.id, username: payload.username };

      return true;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        client.emit('error', { message: 'Токен истёк' });
      } else {
        client.emit('error', { message: 'Невалидный токен' });
      }
      client.disconnect();
      return false;
    }
  }
}
```

Затем применяй `@UseGuards(WsAuthGuard)` на весь gateway — тогда **каждое событие** будет защищено, точно так же как `CheckAuthMiddleware` защищает маршруты:

```typescript
// В chat.gateway.ts — добавить декоратор на класс
@UseGuards(WsAuthGuard)
@WebSocketGateway({ namespace: 'chats', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // ...
}
```

> **Важно:** `@UseGuards` на классе gateway защищает все `@SubscribeMessage` обработчики.  
> Для отклонения соединения **в момент коннекта** (до любых событий) дополнительно проверяем токен в `handleConnection` — это показано в Шаге 7.

---

## Шаг 5 — DTO

Создай `apps/chats/dto/join-room.dto.ts`:

```typescript
import { IsUUID, IsString } from 'class-validator';

export class JoinRoomDto {
  @IsUUID()
  listingId!: string;

  // sellerId — ID владельца объявления
  @IsString()
  sellerId!: string;
}
```

Создай `apps/chats/dto/send-message.dto.ts`:

```typescript
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  listingId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
```

Создай `apps/chats/dto/get-history.dto.ts`:

```typescript
import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GetHistoryDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
```

---

## Шаг 6 — ChatsService

### `apps/chats/src/chats.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepo: Repository<Chat>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  /**
   * Возвращает существующий чат или создаёт новый.
   * Уникальный ключ комнаты = listingId + buyerId.
   */
  async getOrCreateChat(
    listingId: string,
    buyerId: string,
    sellerId: string,
  ): Promise<Chat> {
    let chat = await this.chatRepo.findOne({
      where: { listingId, buyerId },
    });

    if (!chat) {
      chat = this.chatRepo.create({ listingId, buyerId, sellerId });
      await this.chatRepo.save(chat);
    }

    return chat;
  }

  async saveMessage(
    chatId: string,
    senderId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({ chatId, senderId, content });
    return this.messageRepo.save(message);
  }

  async getHistory(
    chatId: string,
    limit = 50,
    offset = 0,
  ): Promise<Message[]> {
    return this.messageRepo.find({
      where: { chatId },
      order: { created_at: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async markMessagesRead(chatId: string, userId: string): Promise<void> {
    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('chatId = :chatId AND senderId != :userId AND isRead = false', {
        chatId,
        userId,
      })
      .execute();
  }
}
```

---

## Шаг 7 — Gateway

Переименуй `event.gateway.ts` в `chat.gateway.ts` и замени содержимое.

### `apps/chats/src/events/chat.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  UseGuards,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatsService } from '../chats.service';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { JoinRoomDto } from '../../dto/join-room.dto';
import { SendMessageDto } from '../../dto/send-message.dto';
import { GetHistoryDto } from '../../dto/get-history.dto';

// WsAuthGuard защищает все @SubscribeMessage обработчики разом —
// аналог CheckAuthMiddleware для HTTP маршрутов
@UseGuards(WsAuthGuard)
@WebSocketGateway({ namespace: 'chats', cors: { origin: '*' } })
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chatsService: ChatsService) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  // handleConnection срабатывает ДО Guard-ов — здесь отключаем
  // клиента сразу при коннекте если токена нет вообще.
  // Guard дополнительно проверяет каждое событие.
  handleConnection(client: Socket) {
    const raw: string = client.handshake.auth?.token ?? '';

    if (!raw.startsWith('Bearer ')) {
      client.emit('error', { message: 'Не авторизован' });
      client.disconnect();
      return;
    }

    console.log(`[WS] Подключился: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    console.log(`[WS] Отключился: ${user?.username ?? client.id}`);
  }

  // ─── События ──────────────────────────────────────────────────────────────

  /**
   * СОБЫТИЕ: joinRoom
   *
   * Клиент отправляет:  { listingId, sellerId }
   * Сервер добавляет клиента в комнату `room:<listingId>:<buyerId>`
   * и возвращает историю сообщений.
   *
   * Оба участника (покупатель и продавец) вызывают joinRoom с одним listingId.
   * sellerId — это userId владельца объявления.
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomDto,
  ) {
    const user = client.data.user;
    const buyerId = user.id;
    const roomName = `room:${body.listingId}:${buyerId}`;

    // Создаём или загружаем запись чата
    const chat = await this.chatsService.getOrCreateChat(
      body.listingId,
      buyerId,
      body.sellerId,
    );

    await client.join(roomName);
    client.data.currentChatId = chat.id;
    client.data.currentRoom = roomName;

    // Отмечаем входящие сообщения как прочитанные при входе в комнату
    await this.chatsService.markMessagesRead(chat.id, user.id);

    // Отправляем последние 50 сообщений только этому клиенту
    const history = await this.chatsService.getHistory(chat.id);
    client.emit('history', history);

    client.emit('joinedRoom', { roomName, chatId: chat.id });
  }

  /**
   * СОБЫТИЕ: sendMessage
   *
   * Клиент отправляет:  { listingId, content }
   * Сервер сохраняет сообщение и рассылает его всем в комнате.
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendMessageDto,
  ) {
    const user = client.data.user;
    const chatId: string | undefined = client.data.currentChatId;
    const roomName: string | undefined = client.data.currentRoom;

    if (!chatId || !roomName) {
      client.emit('error', { message: 'Сначала нужно войти в комнату' });
      return;
    }

    const message = await this.chatsService.saveMessage(
      chatId,
      user.id,
      body.content,
    );

    // Рассылаем всем в комнате (включая отправителя)
    this.server.to(roomName).emit('newMessage', {
      id: message.id,
      senderId: message.senderId,
      senderName: user.username,
      content: message.content,
      created_at: message.created_at,
    });
  }

  /**
   * СОБЫТИЕ: getHistory
   *
   * Клиент отправляет:  { listingId, limit?, offset? }
   * Используется для пагинации — загрузка более старых сообщений.
   */
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: GetHistoryDto,
  ) {
    const chatId: string | undefined = client.data.currentChatId;

    if (!chatId) {
      client.emit('error', { message: 'Сначала нужно войти в комнату' });
      return;
    }

    const messages = await this.chatsService.getHistory(
      chatId,
      body.limit,
      body.offset,
    );

    client.emit('history', messages);
  }

  /**
   * СОБЫТИЕ: markRead
   *
   * Клиент отправляет: {} — отмечает все непрочитанные в текущей комнате
   */
  @SubscribeMessage('markRead')
  async handleMarkRead(@ConnectedSocket() client: Socket) {
    const chatId: string | undefined = client.data.currentChatId;

    if (!chatId) return;

    await this.chatsService.markMessagesRead(chatId, client.data.user.id);
    client.emit('markedRead', { chatId });
  }
}
```

---

## Шаг 8 — Обновляем main.ts

### `apps/chats/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ChatsModule } from './chats.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ChatsModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: '*' });

  const port = process.env.CHATS_PORT ?? 3003;
  await app.listen(port);
  console.log(`[Chats] WebSocket сервер запущен на порту ${port}`);
}
bootstrap();
```

---

## Шаг 9 — Тестирование в Postman

### 9.1 — Подключение

1. Открой Postman → **New** → **WebSocket**
2. Введи URL:
   ```
   ws://localhost:3003/chats
   ```
3. Перейди во вкладку **Params** → секция **Auth** → добавь ключ:
   ```
   token = Bearer <твой_jwt_токен>
   ```
   > Это важно: Socket.IO передаёт данные авторизации через `handshake.auth`, а не через HTTP заголовки.
4. Нажми **Connect**

Если токен невалиден — придёт событие `error` и соединение закроется:
```json
{ "message": "Не авторизован" }
```

---

### 9.2 — Войти в комнату

Отправь событие `joinRoom`:

```json
{
  "listingId": "uuid-объявления",
  "sellerId": "uuid-продавца"
}
```

**Ответные события от сервера:**

| Событие | Данные |
|---|---|
| `joinedRoom` | `{ "roomName": "room:<listingId>:<buyerId>", "chatId": "<uuid>" }` |
| `history` | Массив прошлых сообщений (может быть пустым) |

---

### 9.3 — Отправить сообщение

Событие `sendMessage`:

```json
{
  "listingId": "uuid-объявления",
  "content": "Привет, ещё продаётся?"
}
```

**Все участники комнаты получат:**

```json
{
  "id": "uuid-сообщения",
  "senderId": "uuid-покупателя",
  "senderName": "john_doe",
  "content": "Привет, ещё продаётся?",
  "created_at": "2026-04-15T12:00:00.000Z"
}
```

---

### 9.4 — Симуляция двух пользователей

Чтобы протестировать полноценный диалог:

1. Открой **Вкладку 1** → подключись как **покупатель** (JWT покупателя)
2. Открой **Вкладку 2** → подключись как **продавец** (JWT продавца)
3. Оба отправляют `joinRoom` с одним и тем же `listingId`
   - Покупатель: `{ listingId, sellerId }` — `buyerId` берётся из JWT автоматически
   - Продавец: `{ listingId, sellerId: свой_id }` — сервер вычислит ту же комнату
4. Покупатель отправляет `sendMessage` → обе вкладки получают `newMessage`

---

### 9.5 — Загрузить старые сообщения (пагинация)

Событие `getHistory`:

```json
{
  "listingId": "uuid-объявления",
  "limit": 20,
  "offset": 50
}
```

---

## Справочник событий

| Событие (клиент → сервер) | Данные | Описание |
|---|---|---|
| `joinRoom` | `{ listingId, sellerId }` | Войти в комнату чата |
| `sendMessage` | `{ listingId, content }` | Отправить сообщение |
| `getHistory` | `{ listingId, limit?, offset? }` | Получить историю (пагинация) |
| `markRead` | `{}` | Отметить все сообщения как прочитанные |

| Событие (сервер → клиент) | Данные | Описание |
|---|---|---|
| `joinedRoom` | `{ roomName, chatId }` | Подтверждение входа в комнату |
| `history` | `Message[]` | История сообщений |
| `newMessage` | `{ id, senderId, senderName, content, created_at }` | Новое сообщение (broadcast) |
| `markedRead` | `{ chatId }` | Подтверждение прочтения |
| `error` | `{ message }` | Ошибка от сервера |

---

## Структура файлов после реализации

```
apps/chats/
├── dto/
│   ├── join-room.dto.ts
│   ├── send-message.dto.ts
│   └── get-history.dto.ts
├── entities/
│   ├── chat.entity.ts
│   └── message.entity.ts
├── src/
│   ├── events/
│   │   └── chat.gateway.ts
│   ├── guards/
│   │   └── ws-jwt.guard.ts
│   ├── chats.controller.ts
│   ├── chats.module.ts
│   ├── chats.service.ts
│   └── main.ts
└── CHAT_DOCUMENTATION.md
```

---

==================================================================================================

# Минимальный чат с нуля — без авторизации

Цель: подключиться, отправить сообщение, увидеть его у всех подключённых. Сообщения сохраняются в БД.

---

## 1 — Сущность для сообщений

Создай файл `apps/chats/entities/message.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  username!: string;

  @Column('text')
  content!: string;

  @CreateDateColumn()
  created_at!: Date;
}
```

---

## 2 — Подключаем БД в модуле

### `apps/chats/src/chats.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsService } from './chats.service';
import { ChatGateway } from './events/chat.gateway';
import { Message } from '../entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('CHATS_POSTGRES_DB'),
        entities: [Message],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Message]),
  ],
  providers: [ChatsService, ChatGateway],
})
export class ChatsModule {}
```

Добавь в `.env`:
```env
CHATS_POSTGRES_DB=postgres://user:password@localhost:5432/chats_db
```

---

## 3 — Сервис

### `apps/chats/src/chats.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  // Сохраняем сообщение в БД
  async save(username: string, content: string): Promise<Message> {
    const msg = this.messageRepo.create({ username, content });
    return this.messageRepo.save(msg);
  }

  // Возвращаем последние 50 сообщений
  async getAll(): Promise<Message[]> {
    return this.messageRepo.find({
      order: { created_at: 'ASC' },
      take: 50,
    });
  }
}
```

---

## 4 — Gateway

### `apps/chats/src/events/chat.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from '../chats.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chatsService: ChatsService) {}

  // Срабатывает когда кто-то подключился
  handleConnection(client: Socket) {
    console.log(`Подключился: ${client.id}`);
  }

  // Срабатывает когда кто-то отключился
  handleDisconnect(client: Socket) {
    console.log(`Отключился: ${client.id}`);
  }

  // Слушаем событие 'sendMessage' от клиента
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { username: string; content: string },
  ) {
    // Сохраняем в БД
    const message = await this.chatsService.save(body.username, body.content);

    // Рассылаем всем подключённым клиентам
    this.server.emit('newMessage', message);
  }

  // Слушаем событие 'getHistory' — клиент просит историю
  @SubscribeMessage('getHistory')
  async handleHistory(@ConnectedSocket() client: Socket) {
    const messages = await this.chatsService.getAll();

    // Отправляем историю только тому кто попросил
    client.emit('history', messages);
  }
}
```

---

## 5 — Тестирование в Postman

### Подключение
1. Postman → **New** → **WebSocket**
2. URL: `ws://localhost:3000` (порт из `main.ts`)
3. Нажми **Connect** — в консоли увидишь `Подключился: <id>`

### Запросить историю
Отправь событие `getHistory`, данные не нужны:
```json
{}
```
В ответ придёт событие `history` со списком сообщений из БД.

### Отправить сообщение
Отправь событие `sendMessage`:
```json
{
  "username": "Вася",
  "content": "Привет всем!"
}
```
Все подключённые клиенты получат событие `newMessage`:
```json
{
  "id": "uuid",
  "username": "Вася",
  "content": "Привет всем!",
  "created_at": "2026-04-15T12:00:00.000Z"
}
```

### Симуляция двух пользователей
Открой две вкладки WebSocket в Postman → подключи обе → отправь сообщение из одной → оно придёт в обе вкладки одновременно.
