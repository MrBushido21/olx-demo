import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { UserInfoJWT } from '../dto/jwtUserInfo.dto';
import { env } from 'libs/common/conf/env.checker';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

export const hashedPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}


export const comparePassword = async (password: string, hashedPass: string) => {
    const isMatch = await bcrypt.compare(password, hashedPass)
    return isMatch
}

export const createJWT = (userInfo: UserInfoJWT) => {

    const access_token = jwt.sign(userInfo, env.JWT_ACCESS_SECRET, { expiresIn: '1h' })
    const refresh_token = jwt.sign(userInfo, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })

    return { access_token, refresh_token }
}

export function getExpiredAt(days: number): Date {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date  // возвращаем объект, не результат setDate
}


export const getUserByEmail = async (email: string, usersClient: ClientProxy) => {
    const user = await firstValueFrom(
        usersClient.send('user.findByEmail', { email }).pipe(timeout(10000))
    )
    return user
}