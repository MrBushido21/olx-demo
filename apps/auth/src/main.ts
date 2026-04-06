import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { envcheker } from 'libs/common/conf/env.checker';
import { mainstart } from '@app/common';

const env = envcheker();
async function bootstrap() {
  await mainstart(env, AuthModule, 'auth-api', +env.AUTH_PORT)
}
bootstrap();
