import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserRefreshTokens } from '../entities/user-refresh.entity';
import { UserVerifyCodes } from '../entities/user-verifycodes.entity';
import { UserResetTokens } from '../entities/user-reset.entitty';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('AUTH_POSTGRES_DB',
      [UserRefreshTokens, UserVerifyCodes, UserResetTokens])
    ),
    TypeOrmModule.forFeature([UserRefreshTokens, UserVerifyCodes, UserResetTokens]),
    ThrottlerModule.forRoot([{
        ttl: 60000,  // окно в миллисекундах (1 минута)
        limit: 5,    // максимум 5 запросов за это время
      }]),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL', '')],
            queue: 'auth_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
      // Клиент для общения с listings сервисом (слушает на users_queue)
      {
        name: 'LISTINGS_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL', '')],
            queue: 'users_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      // =============================================================================
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})

export class AuthModule implements NestModule { 
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes({ path: 'auth/changeuserinfo', method: RequestMethod.POST });
  }

}
