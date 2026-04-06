import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Listings } from '../entities/listings.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ListingImages } from '../entities/listingImages.entity';
import { CreateListingDto } from '../dto/createlisting.dto';
import { getExpiredAt } from '@app/common';
import { CATEGORY_FIELDS } from '../conf/categories.config';
import { CATEGORY_KEYWORDS } from '../conf/categoryKeywords.config';
import { checkAtributes } from '../utils/utils';
import { GetListingsQueryParams } from '../dto/getListingsQueryParams.dto';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listings)
    private listingsRepository: Repository<Listings>,

    @InjectRepository(ListingImages)
    private listingsImagesRepository: Repository<ListingImages>
  ) { }

  //GET
  async getListings(userId: string, page:number, params?:GetListingsQueryParams) {
    const active = params?.hidden || 'active'
    const query = this.listingsRepository
    .createQueryBuilder('l')
    .where('l.userId = :userId AND l.active = :active', {userId, active})
    if (params?.query) {
      query.andWhere('similarity(LOWER(l.listing_title), LOWER(:query)) > 0.2', { query: params.query })
    }
    if (params?.category && params?.category !== 'all') {
      query.andWhere('l.listing_category = :category', {category: params.category})
    }
    //Сортировать по алфовиту название
    //Сортировать по дате публикации
    //Сортировать по дате цене
    const order = params?.order ?? 'DESC'
    switch (params?.sortedBy) {
      case 'abc':
        query.orderBy('l.listing_title', order)
        break;
      case 'created':
      query.orderBy('l.created_at', order)
         break;
      case 'price':
      query.orderBy("CAST(l.listing_atributes->>'price' AS NUMERIC)", order)
       break;
      default:
        query.orderBy('l.listing_title', 'ASC')
        break;
    }
    page = page ?? 1
    return query.skip((Number(page) - 1) * 20).take(20).getManyAndCount()
  }

  async getListing(id: string) {
    await this.listingsRepository.increment({id}, 'views', 1)
    return await this.listingsRepository.findOne({ where: { id } })
  }

 async getMyCategories(userId: string) {                                                                
    return this.listingsRepository
      .createQueryBuilder('l')
      .select('DISTINCT l.listing_category', 'category')
      .where('l.userId = :userId', {userId})
      .getRawMany()
  }

  //POST
  async postListings(dto: CreateListingDto, userId: string) {
    //Проверка на все атрибуты
    checkAtributes(dto)
    const listing = this.listingsRepository.create(dto)
    const expired_at = getExpiredAt(30)
    await this.listingsRepository.save({ ...listing, userId, expired_at })
    return listing
  }

  matchCategories(listing_title: string) {
    const title = listing_title.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(word => title.includes(word))) {
        return category;
      }
    }
  }

  //Првоеряем что обьявление принедлежит пользователю
  async isUserListing(userId:string, id:string) {
    const oldListing = await this.listingsRepository.findOne({where: {userId, id}})
    if (!oldListing) {
      throw new UnauthorizedException('Вы не имеете права редактировать чужие обьявления')
    }
  }

  //PUT
  async updateListing(dto:CreateListingDto, userId:string, id:string) {
    //Проверка на все атрибуты
    checkAtributes(dto)

    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)

    const newlisting = this.listingsRepository.create(dto)
    return await this.listingsRepository.update({id}, newlisting)
  }

  //PATCH

  async hiddenListing(id:string, userId:string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({id}, {active: "hidden"})
  }

  async activateListing(id:string, userId:string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({id}, {active: "active"})
  }

  async updateLikeListing(id:string) {
    await this.listingsRepository.increment({id}, 'likes', 1)
  }

  
  
  //DELETE
  async deleteListing(id:string, userId:string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    return await this.listingsRepository.delete({id})
  }
}
