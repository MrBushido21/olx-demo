import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { envcheker } from "libs/common/conf/env.checker";
import { Socket } from "socket.io";
import jwt from 'jsonwebtoken'

const env = envcheker()
@Injectable()
export class WsAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
       const client: Socket = context.switchToWs().getClient()
       
       try {
        const raw:string = client.handshake.headers?.token as string ?? ""
        console.log(raw);
        
        if (!raw.startsWith('Bearer ')) {
            client.emit('error', {message: 'Unauthorized after connect'})
            client.disconnect()
            return false
        }

        const token = raw.split(' ')[1]
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET ?? '') as jwt.JwtPayload

        // Кладём userId в сокет — как req.user в HTTP
        client.data.userId = payload.id
        return true
       } catch (error) {
        console.error(error);
        client.emit('error', {message: 'Somthing wrong'})
        client.disconnect()
        return false
       }
    }
}