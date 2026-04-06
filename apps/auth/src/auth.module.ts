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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('AUTH_POSTGRES_DB',
      [UserRefreshTokens, UserVerifyCodes, UserResetTokens])
    ),
    TypeOrmModule.forFeature([UserRefreshTokens, UserVerifyCodes, UserResetTokens]),
    ClientsModule.registerAsync([{
      name: 'USERS_SERVICE',
      useFactory: (configService: ConfigService) => ({
        transport: Transport.RMQ,
        options: {
          urls: [configService.get<string>('RABBITMQ_URL', '')],
          queue: 'users_queue',
          queueOptions: { durable: true },
        },
      }),
      inject: [ConfigService],
    }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})

export class AuthModule implements NestModule { 
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes({ path: 'auth/changeuserinfo', method: RequestMethod.POST });
  }

}
