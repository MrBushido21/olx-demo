import { NestFactory } from '@nestjs/core';
import { ChatsModule } from './chats.module';
import { mainstart } from '@app/common';
import { envcheker } from 'libs/common/conf/env.checker';

const env = envcheker();
async function bootstrap() {
  await mainstart(env, ChatsModule, '', +env.CHATS_PORT, 'listings_queue')
}
bootstrap();
