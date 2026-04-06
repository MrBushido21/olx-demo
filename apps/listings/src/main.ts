import { NestFactory } from '@nestjs/core';
import { ListingsModule } from './listings.module';
import { envcheker } from 'libs/common/conf/env.checker';
import { mainstart } from '@app/common';

const env = envcheker();
async function bootstrap() {
  await mainstart(env, ListingsModule, 'listings-api', +env.LISTINGS_PORT)
}
bootstrap();;
