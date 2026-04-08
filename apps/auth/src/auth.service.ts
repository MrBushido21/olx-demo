import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import {  Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { comparePassword, createJWT, getExpiredAt, getUserByEmail, hashedPassword } from '../utils/utils';
import { LoginUserDto } from '../dto/login-user.dto';
import { UserRefreshTokens } from '../entities/user-refresh.entity';
import { UserVerifyCodes } from '../entities/user-verifycodes.entity';
import { UserResetTokens } from '../entities/user-reset.entitty';
import { ChangePassDto } from '../dto/changepass.dto';
import { env } from 'libs/common/conf/env.checker';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserRefreshTokens)
    private refreshRepository: Repository<UserRefreshTokens>,

    @InjectRepository(UserVerifyCodes)
    private verifyRepository: Repository<UserVerifyCodes>,

    @InjectRepository(UserResetTokens)
    private resetRepository: Repository<UserResetTokens>,

    @Inject('AUTH_SERVICE')
    private usersClient: ClientProxy,
  ) { }

  //Make shure in user email
  async registerLink(email: string) {
    //Првоеряем что емейл не зарегистрирован уже
    const user = await getUserByEmail(email, this.usersClient)
    // const user = await this.authRepository.findOne({ where: { email } })
    const vatify_email = await this.verifyRepository.findOne({ where: { user_email: email } })
    if (user || vatify_email) {
      throw new ConflictException('Пользователь с таким емейлом уже существует');
    }
    //Создаем токен для поддтверждения емейла
    const token = crypto.randomBytes(32).toString('hex')
    const expired_at = getExpiredAt(7)
    //Сохраняем емейл и токен для поддтверждения подлености ссылки и емейл для регистрации
    await this.verifyRepository.save({ token, user_email: email, expired_at })
    return `${env.BASE_URL}auth/register?token=${token}`
  }

  //Registration
  async register(dto: CreateUserDto) {
    //Ишем токен для поодтвеждаюищй что ссылка была действительна
    const token = await this.verifyRepository.findOne(
      {
        where: { token: dto.token },
        order: { created_at: 'DESC' }
      }
    )
    if (!token) {
      throw new BadRequestException('Неверная ссылка')
    }

    if (token.expired_at < new Date()) {
      throw new BadRequestException('Ссылка устарела')
    }
    const password = await hashedPassword(dto.password)
    const userId = uuidv4()

    await firstValueFrom(
      this.usersClient.send('user.created', {
        id: userId,
        username: dto.username,
        email: token.user_email,
        password,
        status: 'active',
        role: 'user',
      }).pipe(
      timeout(5000) // 5 секунд и бросает ошибку
    )
  )

    await this.verifyRepository.delete(token.id)
    const jwtTokens = createJWT({ id: userId, username: dto.username })
    const expired_at = getExpiredAt(7)
    await this.refreshRepository.save({ refreshToken: jwtTokens.refresh_token, expired_at, userId })
    return jwtTokens   
  }

  //Login
  async login(dto: LoginUserDto) {
    const user = await getUserByEmail(dto.email, this.usersClient) 
    if (!user) {
      throw new UnauthorizedException('Неправильный логин или пароль')
    }
    const isMath = await comparePassword(dto.password, user.password)

    if (!isMath) {
      throw new UnauthorizedException('Неправильный логин или пароль')
    }

    const jwtTokens = createJWT({ id: user.id, username: user.username })
    await this.refreshRepository.delete({ userId: user.id })
    const expired_at = getExpiredAt(7)
    await this.refreshRepository.save({ refreshToken: jwtTokens.refresh_token, expired_at, userId: user.id })
    return jwtTokens
  }
  //ResetPass
   async reset(email: string) {
    const user = await getUserByEmail(email, this.usersClient)
    if (!user) {
      return
    }
    const token = crypto.randomBytes(32).toString('hex')
    const expired_at = new Date();
    expired_at.setMinutes(expired_at.getMinutes() + 2);
    await this.resetRepository.save({ token, userId: user.id, expired_at })
    return `${env.BASE_URL}auth/resetpassword?token=${token}`
  }

  //ChangePass
  async changepass(dto: ChangePassDto) {
    const token = await this.resetRepository.findOne({ where: { token: dto.token }, order: { created_at: 'DESC' } })

    if (!token) {
      throw new NotFoundException("Текен не найдено")
    } else if (token.expired_at < new Date()) {
      throw new BadRequestException('Ссылка устарела')
    }

    const hashPass = await hashedPassword(dto.password)

     const user = await firstValueFrom(
      this.usersClient.send('user.findById', {id: token.userId}).pipe(timeout(10000))
    )
    if (!user) {
      console.error(`userID ${token.userId} не найден соотвествующий юзер`);
      throw new InternalServerErrorException("Чтото пошло не так")
    }

    await firstValueFrom(
      this.usersClient.send('user.updatePass', {id: token.userId, password: hashPass}).pipe(timeout(10000))
    )
    const userInfo = { id: user.id, username: user.username }
    const jwtTokens = createJWT(userInfo)

    await this.refreshRepository.delete({ userId: user.id })
    await this.resetRepository.delete({ userId: user.id })

    const expired_at = getExpiredAt(7)
    await this.refreshRepository.save({ refreshToken: jwtTokens.refresh_token, userId: user.id, expired_at: expired_at })
    return jwtTokens
  }

  //change user info

  async changeuserinfo(dto: ChangeUserInfoDto, userId: string) {
    // Нельзя сохранять пустые данные если были не пустые
    const user = await firstValueFrom(
      this.usersClient.send('user.findById', {id: userId}).pipe(timeout(10000))
    )
    if (!user) {
      console.error('auth/changeuserinfo/service user is undefined');
      throw new UnauthorizedException('Неопознаный пользователь')
    }
    const newUser = {
      username: dto.username ? dto.username : user.username,
      location: dto.location ? dto.location : user.location,
      phone: dto.phone ? dto.phone : user.phone,
      avatar: dto.avatar ? dto.avatar : user.avatar,
    }

    await firstValueFrom(
      this.usersClient.send('user.updateUserInfo', {id: userId, newUser}).pipe(timeout(10000))
    )
  }

  async logout(refreshToken:string) {
    this.refreshRepository.delete({refreshToken})
  }
}
