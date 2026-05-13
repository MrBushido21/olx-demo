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
import { ReportEntity } from '../entities/listingReport.entity';
import { ReviewEntity } from '../entities/listingRewie.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(TypeOrmModuleConf('LISTINGS_POSTGRES_DB',
      [Listings, ListingImages, ReportEntity, ReviewEntity])
    ),
    TypeOrmModule.forFeature([Listings, ListingImages, ReportEntity,
      ReviewEntity
    ]),
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
      .forRoutes(
        { path: 'listings/my', method: RequestMethod.GET },
        { path: 'listings/my-categories', method: RequestMethod.GET },
        { path: 'listings/create', method: RequestMethod.POST },
        { path: 'listings/images-edit', method: RequestMethod.POST },
        { path: 'listings/:id/chat', method: RequestMethod.POST },
        { path: 'listings/:id', method: RequestMethod.PUT },
        { path: 'listings/:id', method: RequestMethod.DELETE },
        { path: 'listings/:id', method: RequestMethod.PATCH },
        { path: 'listings/activate/:id', method: RequestMethod.PUT },
        { path: 'listings/:id/review', method: RequestMethod.POST },
        { path: 'listings/:id/report', method: RequestMethod.POST },
      )
  }
}