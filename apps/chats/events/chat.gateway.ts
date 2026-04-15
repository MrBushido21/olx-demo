import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatsService } from "../src/chats.service";
import { UseGuards } from "@nestjs/common";
import { WsAuthGuard } from "../src/guards/ws-auth.guard";
import { JwtPayload } from "jsonwebtoken";
import { envcheker } from "libs/common/conf/env.checker";
import jwt from 'jsonwebtoken'

const env = envcheker()
@UseGuards(WsAuthGuard)
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
            client.emit('error', { message: 'Somthing error' })
            client.disconnect()
        }

    }

    handleDisconnect(client: Socket) {
        console.log(`${client.id} has disconnected}`);
    }

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() body: { content: string },
        @ConnectedSocket() client: Socket
    ) {
        console.log(`${client.id} send ${body.content}`);

        const userId = client.data.userId
        const content = await this.chatService.save(userId, body.content)
        this.server.emit('newMessage', content)
    }

    @SubscribeMessage('getMessage')
    async handleGetMessage(@ConnectedSocket() client: Socket) {
        const messages = await this.chatService.getAll()
        client.emit('history', messages)
    }
}