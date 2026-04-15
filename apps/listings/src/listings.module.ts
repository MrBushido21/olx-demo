import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Listings } from '../entities/listings.entity';
import { ListingImages } from '../entities/listingImages.entity';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryProvider } from 'libs/common/providers/cloudinary';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('LISTINGS_POSTGRES_DB',
      [Listings, ListingImages])
    ),
    TypeOrmModule.forFeature([Listings, ListingImages]),
    MulterModule.register({
      storage: memoryStorage(),
    }),
    ClientsModule.registerAsync([{
      name: 'LISTINGS_SERVICE',
      useFactory: (configService: ConfigService) => ({
        transport: Transport.RMQ,
        options: {
          urls: [configService.get<string>('RABBITMQ_URL', '')],
          queue: 'listings_queue',
          queueOptions: { durable: true },
        },
      }),
      inject: [ConfigService],
    }]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, CloudinaryProvider],
})
export class ListingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes('listings');
  }
}