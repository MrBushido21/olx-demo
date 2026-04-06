import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Listings } from '../entities/listings.entity';
import { ListingImages } from '../entities/listingImages.entity';
import { CheckAuthMiddleware } from 'libs/common/middleware/checkauth.middleware';
import { TypeOrmModuleConf } from 'libs/common/conf/TypeOrmModule.conf';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync( TypeOrmModuleConf('LISTINGS_POSTGRES_DB',
      [Listings, ListingImages])
    ),
    TypeOrmModule.forFeature([Listings, ListingImages])
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CheckAuthMiddleware)
      .forRoutes('listings');
  }
}