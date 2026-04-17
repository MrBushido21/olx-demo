import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatsService } from "../src/chats.service";
import { UnauthorizedException, UseGuards } from "@nestjs/common";
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
        }

        try {
            const token = raw.split(' ')[1]
            jwt.verify(token, env.JWT_ACCESS_SECRET ?? '') as JwtPayload
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
        @MessageBody() body: { content: string },
        @ConnectedSocket() client: Socket
    ) {
        console.log(`${client.id} send ${body.content}`);

        const userId = client.data.userId
        const chatId = client.data.chatId

        if (!chatId) return

        const content = await this.chatService.save(userId, chatId, body.content)
        this.server.to(chatId).emit('newMessage', content)
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