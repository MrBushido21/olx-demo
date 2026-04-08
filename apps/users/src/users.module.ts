import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { Users } from '../entity/user.entity';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';
import { FavoritesEntity } from '../entity/favorites.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('USERS_POSTGRES_DB', [Users, FavoritesEntity])),
    TypeOrmModule.forFeature([Users, FavoritesEntity]),
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
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes('users');
      // .forRoutes({ path: 'users/changeuserinfo', method: RequestMethod.PATCH });
  }
}
