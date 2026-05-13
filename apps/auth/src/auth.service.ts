import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { comparePassword, createJWT, getExpiredAt, getUserByEmail, hashedPassword } from '../utils/utils';
import { LoginUserDto } from '../dto/login-user.dto';
import { UserRefreshTokens } from '../entities/user-refresh.entity';
import { UserVerifyCodes } from '../entities/user-verifycodes.entity';
import { UserResetTokens } from '../entities/user-reset.entitty';
import { ChangePassDto } from '../dto/changepass.dto';
import { env } from 'libs/common/conf/env.checker';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom, timeout } from 'rxjs';
import jwt from 'jsonwebtoken';

// ─── Email sending (MVP stub) ─────────────────────────────────────────────────
// To enable real email delivery, install nodemailer:
//   npm install nodemailer @types/nodemailer
// Add to .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//
// import nodemailer from 'nodemailer';
//
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT),
//   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
// });
//
// async function sendEmail(to: string, subject: string, html: string) {
//   await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
// }
// ─────────────────────────────────────────────────────────────────────────────

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

    // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
    @Inject('LISTINGS_SERVICE')
    private listingsClient: ClientProxy,
    // =============================================================================

    private dataSource: DataSource,
  ) { }

  async registerLink(email: string) {
    const user = await getUserByEmail(email, this.usersClient)
    const vatify_email = await this.verifyRepository.findOne({ where: { user_email: email } })
    if (user || vatify_email) {
      throw new ConflictException('Пользователь с таким емейлом уже существует');
    }
    const token = crypto.randomBytes(32).toString('hex')
    const expired_at = getExpiredAt(7)
    await this.verifyRepository.save({ token, user_email: email, expired_at })

    const link = `${env.BASE_URL}auth/register?token=${token}`

    // When email is enabled, replace the return below with:
    // await sendEmail(email, 'Confirm your registration', `<a href="${link}">Confirm email</a>`);
    // return 'Confirmation link sent to your email';
    return link
  }

  async register(dto: CreateUserDto) {
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
      }).pipe(timeout(5000))
    )

    const jwtTokens = createJWT({ id: userId, username: dto.username })
    const expired_at = getExpiredAt(7)

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserVerifyCodes, token.id)
      await manager.save(UserRefreshTokens, { refreshToken: jwtTokens.refresh_token, expired_at, userId })
    })

    return jwtTokens
  }

  async login(dto: LoginUserDto) {
    const user = await getUserByEmail(dto.email, this.usersClient)
    if (!user) {
      throw new UnauthorizedException('Неправильный логин или пароль')
    }
    const isMatch = await comparePassword(dto.password, user.password)
    if (!isMatch) {
      throw new UnauthorizedException('Неправильный логин или пароль')
    }

    const jwtTokens = createJWT({ id: user.id, username: user.username })
    await this.refreshRepository.delete({ userId: user.id })
    const expired_at = getExpiredAt(7)
    await this.refreshRepository.save({ refreshToken: jwtTokens.refresh_token, expired_at, userId: user.id })
    return jwtTokens
  }

  async reset(email: string) {
    const user = await getUserByEmail(email, this.usersClient)
    if (!user) {
      return
    }
    const token = crypto.randomBytes(32).toString('hex')
    const expired_at = new Date();
    expired_at.setMinutes(expired_at.getMinutes() + 15);
    await this.resetRepository.save({ token, userId: user.id, expired_at })

    const link = `${env.BASE_URL}auth/resetpassword?token=${token}`

    // When email is enabled, replace the return below with:
    // await sendEmail(email, 'Password reset', `<a href="${link}">Reset password</a>`);
    // return 'Password reset link sent to your email';
    return link
  }

  async changepass(dto: ChangePassDto) {
    const token = await this.resetRepository.findOne({ where: { token: dto.token }, order: { created_at: 'DESC' } })

    if (!token) {
      throw new NotFoundException('Token not found')
    } else if (token.expired_at < new Date()) {
      throw new BadRequestException('Ссылка устарела')
    }

    const hashPass = await hashedPassword(dto.password)

    const user = await firstValueFrom(
      this.usersClient.send('user.findById', { id: token.userId }).pipe(timeout(10000))
    )
    if (!user) {
      console.error(`userID ${token.userId} не найден соотвествующий юзер`);
      throw new InternalServerErrorException('Чтото пошло не так')
    }

    await firstValueFrom(
      this.usersClient.send('user.updatePass', { id: token.userId, password: hashPass }).pipe(timeout(10000))
    )
    const jwtTokens = createJWT({ id: user.id, username: user.username })

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRefreshTokens, { userId: user.id })
      await manager.delete(UserResetTokens, { userId: user.id })
      const expired_at = getExpiredAt(7)
      await manager.save(UserRefreshTokens, { refreshToken: jwtTokens.refresh_token, userId: user.id, expired_at })
    })

    return jwtTokens
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing')
    }

    const stored = await this.refreshRepository.findOne({ where: { refreshToken } })
    if (!stored || stored.expired_at < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired')
    }

    let payload: { id: string; username: string }
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string; username: string }
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const newTokens = createJWT({ id: payload.id, username: payload.username })
    const expired_at = getExpiredAt(7)

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRefreshTokens, { refreshToken })
      await manager.save(UserRefreshTokens, { refreshToken: newTokens.refresh_token, expired_at, userId: payload.id })
    })

    return newTokens
  }

  async logout(refreshToken: string) {
    await this.refreshRepository.delete({ refreshToken })
  }

  // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
  async testCreateUser(dto: { email: string; username: string; password: string }) {
    const hashPass = await hashedPassword(dto.password)
    const userId = uuidv4()

    const user = await firstValueFrom(
      this.usersClient.send('user.created', {
        id: userId,
        username: dto.username,
        email: dto.email,
        password: hashPass,
        status: 'active',
        role: 'user',
      }).pipe(timeout(5000))
    )

    const listing = await firstValueFrom(
      this.listingsClient.send('listing.create.test', {
        userId,
        username: dto.username,
      }).pipe(timeout(5000))
    )

    const jwtTokens = createJWT({ id: userId, username: dto.username })
    const expired_at = getExpiredAt(7)
    await this.refreshRepository.save({ refreshToken: jwtTokens.refresh_token, expired_at, userId })

    return {
      access_token: jwtTokens.access_token,
      user: { id: user.id, username: user.username, email: user.email },
      listing,
    }
  }
  // =============================================================================
}
