import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { Users } from '../entity/user.entity';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('USERS_POSTGRES_DB', [Users])),
    TypeOrmModule.forFeature([Users]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes({ path: 'users/changeuserinfo', method: RequestMethod.PATCH });
  }
}
