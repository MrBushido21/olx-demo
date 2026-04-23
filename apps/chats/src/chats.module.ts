import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsService } from './chats.service';
import { MessageEntity } from '../entities/message.entity';
import { ChatGateWay } from '../events/chat.gateway';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { ChatsEntity } from '../entities/chat.entity';
import { ChatsController } from './chats.controller';
import { ChatImgEntity } from '../entities/chatImages.entity';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';
import { CloudinaryProvider } from 'libs/common/providers/cloudinary';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('CHATS_POSTGRES_DB', [MessageEntity, ChatsEntity, ChatImgEntity])),
    TypeOrmModule.forFeature([MessageEntity, ChatsEntity, ChatImgEntity]),
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatGateWay, CloudinaryProvider],
})
export class ChatsModule implements NestModule { 
  configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(CheckAuthMiddleware)
        .forRoutes('chats');
    }
}