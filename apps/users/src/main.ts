import { NestFactory } from '@nestjs/core';
import { UsersModule } from './users.module';
import { mainstart } from '@app/common';
import { envcheker } from 'libs/common/conf/env.checker';

const env = envcheker()
async function bootstrap() {
  await mainstart(env, UsersModule, 'users-api', +env.USERS_PORT, 'auth_queue')
}
bootstrap();
