import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsService } from './chats.service';
import { MessageEntity } from '../entities/message.entity';
import { ChatGateWay } from '../events/chat.gateway';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { ChatsEntity } from '../entities/chat.entity';
import { ChatsController } from './chats.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('CHATS_POSTGRES_DB', [MessageEntity, ChatsEntity])),
    TypeOrmModule.forFeature([MessageEntity, ChatsEntity]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatGateWay],
})
export class ChatsModule {}