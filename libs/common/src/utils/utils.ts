import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Request } from "express";

export const mainstart = async (env: any, module: any, route: string, port: number, rmqQueue?: string) => {
  if (!env) return;
  const app = await NestFactory.create(module);
  const config = new DocumentBuilder()
    .setTitle('casino-auth')
    .setDescription('The casino-auth API description')
    .setVersion('1.0')
    .addTag('casino')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(route, app, documentFactory);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  if (rmqQueue) {
    app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [env.RABBITMQ_URL],
      queue: rmqQueue,
      queueOptions: { durable: true },
    },
  })
  await app.startAllMicroservices()
  }
  
  await app.listen(port ?? 3000);
  return app;
}

export function getExpiredAt(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date  // возвращаем объект, не результат setDate
}

export const getUserId = (req: Request) => {
  const userId = req.user?.id
  if (!userId) {
    console.error('userId undefined');
    throw new UnauthorizedException('Неопознаный пользователь')
  }
  return userId
}