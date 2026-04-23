import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatsService } from "../src/chats.service";
import { NotFoundException, UnauthorizedException, UseGuards } from "@nestjs/common";
import { JwtPayload } from "jsonwebtoken";
import { envcheker } from "libs/common/conf/env.checker";
import jwt from 'jsonwebtoken'

const env = envcheker()
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateWay implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server

    constructor(private readonly chatService: ChatsService) { }

    handleConnection(client: Socket) {
        const raw: string = client.handshake.headers?.token as string ?? '';
        if (!raw.startsWith('Bearer ')) {
            client.emit('error', { message: 'Unauthorized' })
            client.disconnect()
            return
        }

        try {
            const token = raw.split(' ')[1]
            const payload = jwt.verify(token, env.JWT_ACCESS_SECRET ?? '') as JwtPayload
            client.data.userId = payload.id
            return console.log(`${client.id} has connected}`);
        } catch (error) {
            console.error(error);
            if (error instanceof jwt.TokenExpiredError) {
                client.emit('error', { message: 'Токен истёк, авторизуйтесь снова' })
            } else if (error instanceof jwt.JsonWebTokenError) {
                client.emit('error', { message: 'Невалидный токен' })
            } else {
                client.emit('error', { message: 'Ошибка авторизации' })
            }
            client.disconnect()
        }

    }

    handleDisconnect(client: Socket) {
        console.log(`${client.id} has disconnected}`);
    }

    @SubscribeMessage('joinRoom')
    async handleJoinRoom(
        @MessageBody() body: { chatId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId
        const chatId = body.chatId
        const chat = await this.chatService.getUserChate(userId, chatId)

        if (!chat) {
            throw new UnauthorizedException('У вас нет доступа в этот чат')
        }
        await client.join(body.chatId)
        client.data.chatId = chatId
        const messages = await this.chatService.getAll(body.chatId)

        client.emit('history', messages)
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() body: { content: string, imageId?: string },
        @ConnectedSocket() client: Socket
    ) {
        console.log(`${client.id} send ${body.content}`);

        const userId = client.data.userId
        const chatId = client.data.chatId

        if (!chatId) return
        if (!body.content?.trim() && !body.imageId) return

        if (body.imageId) {
            const image = await this.chatService.getMessage(body.imageId)
            if (!image) throw new NotFoundException('Изображение не загружено')

            // если клиент прислал текст вместе с фото — сохраняем его в то же сообщение
            if (body.content?.trim()) {
                await this.chatService.updateMessageContent(body.imageId, body.content)
                image.content = body.content
            }

            this.server.to(chatId).emit('newMessage', image)
        } else {
            const content = await this.chatService.save(userId, chatId, body.content)
            this.server.to(chatId).emit('newMessage', content)
        }


    }

    @SubscribeMessage('getMessage')
    async handleGetMessage(
        @ConnectedSocket() client: Socket
    ) {
        const chatId = client.data.chatId
        const messages = await this.chatService.getAll(chatId)
        client.emit('history', messages)
    }
}