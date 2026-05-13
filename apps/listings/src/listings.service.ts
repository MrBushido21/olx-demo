import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Listings } from '../entities/listings.entity';
import { In, LessThan, Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ListingImages } from '../entities/listingImages.entity';
import { CreateListingDto } from '../dto/createlisting.dto';
import { getExpiredAt } from '@app/common';
import { CATEGORY_FIELDS } from '../conf/categories.config';
import { CATEGORY_KEYWORDS } from '../conf/categoryKeywords.config';
import { checkAtributes, uploadImages } from '../utils/utils';
import { GetListingsQueryParams } from '../dto/getListingsQueryParams.dto';
import { UdpdateLikeDto } from '../dto/updateLike.dto';
import { deleteImageFromCloudinary, uploadImageToCloudinary } from 'libs/common/conf/cloudinary';
import { UploadApiResponse } from 'cloudinary';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import cron from 'node-cron';
import { ReportEntity } from '../entities/listingReport.entity';
import { REPORT_REASONS } from '../conf/reportReasons.config';
import { ReviewEntity } from '../entities/listingRewie.entity';

@Injectable()
export class ListingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Listings)
    private listingsRepository: Repository<Listings>,

    @InjectRepository(ListingImages)
    private listingsImagesRepository: Repository<ListingImages>,

    @InjectRepository(ReportEntity)
    private reportListingsRepo: Repository<ReportEntity>,
    
    @InjectRepository(ReviewEntity)
    private reviewListingsRepo: Repository<ReviewEntity>,

    @Inject('LISTINGS_SERVICE')
    private chatClient: ClientProxy,
  ) { }

  async isUserListing(userId: string, id: string) {
    const listing = await this.listingsRepository.findOne({ where: { userId, id } })
    if (!listing) {
      throw new UnauthorizedException('Вы не имеете права редактировать чужие обьявления')
    }
  }

  async saveListingsImages(uploaded: UploadApiResponse[], listingId: string) {
    await Promise.all(
      uploaded.map(image => this.listingsImagesRepository.save({
        imageUrl: image.url,
        imageKey: image.public_id,
        listingId,
      }))
    )
  }

  // Public: all active listings, no user filter
  async getListings(page: number, params?: GetListingsQueryParams) {
    const query = this.listingsRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.images', 'images')
      .where('l.active = :active', { active: 'active' })

    if (params?.query) {
      query.andWhere('similarity(LOWER(l.listing_title), LOWER(:query)) > 0.2', { query: params.query })
    }
    if (params?.category && params.category !== 'all') {
      query.andWhere('l.listing_category = :category', { category: params.category })
    }
   
    if (params?.priceMin) {
      query.andWhere("CAST(l.listing_atributes->>'price' AS NUMERIC) >= :priceMin", { priceMin: params.priceMin })
    }

    if (params?.priceMax) {
      query.andWhere("CAST(l.listing_atributes->>'price' AS NUMERIC) <= :priceMax", { priceMax: params.priceMax })
    }
    const order = params?.order ?? 'DESC'
    switch (params?.sortedBy) {
      case 'abc':
        query.orderBy('l.listing_title', order)
        break
      case 'created':
        query.orderBy('l.created_at', order)
        break
      case 'price':
        query.orderBy("CAST(l.listing_atributes->>'price' AS NUMERIC)", order)
        break
      default:
        query.orderBy('l.created_at', 'DESC')
    }

    const pageNum = page ?? 1
    return query.skip((Number(pageNum) - 1) * 20).take(20).getManyAndCount()
  }

  // Authenticated: user's own listings with hidden support
  async getMyListings(page: number, userId: string, params?: GetListingsQueryParams) {
    const active = params?.hidden ? 'hidden' : 'active'

    const query = this.listingsRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.images', 'images')
      .where('l.userId = :userId AND l.active = :active', { userId, active })

    if (params?.query) {
      query.andWhere('similarity(LOWER(l.listing_title), LOWER(:query)) > 0.2', { query: params.query })
    }
    if (params?.category && params.category !== 'all') {
      query.andWhere('l.listing_category = :category', { category: params.category })
    }

    const order = params?.order ?? 'DESC'
    switch (params?.sortedBy) {
      case 'abc':
        query.orderBy('l.listing_title', order)
        break
      case 'created':
        query.orderBy('l.created_at', order)
        break
      case 'price':
        query.orderBy("CAST(l.listing_atributes->>'price' AS NUMERIC)", order)
        break
      default:
        query.orderBy('l.created_at', 'DESC')
    }

    const pageNum = page ?? 1
    return query.skip((Number(pageNum) - 1) * 20).take(20).getManyAndCount()
  }

  async getListing(id: string) {
    await this.listingsRepository.increment({ id }, 'views', 1)
    return await this.listingsRepository.findOne({ where: { id }, relations: { images: true } })
  }

  async getMyCategories(userId: string) {
    return this.listingsRepository
      .createQueryBuilder('l')
      .select('DISTINCT l.listing_category', 'category')
      .where('l.userId = :userId', { userId })
      .getRawMany()
  }

  async getMyFavorites(listingIds: string[]) {
    if (!listingIds.length) return []
    return this.listingsRepository.find({
      where: { id: In(listingIds) },
      relations: { images: true },
    })
  }

  async postListings(dto: CreateListingDto, userId: string, files: Express.Multer.File[]) {
    checkAtributes(dto)
    const uploaded = await uploadImages(files)
    const listing = this.listingsRepository.create(dto)
    const expired_at = getExpiredAt(30)
    const listingSaved = await this.listingsRepository.save({ ...listing, userId, expired_at })
    this.saveListingsImages(uploaded, listingSaved.id)
    return listingSaved
  }

  onModuleInit() {
      this.deactivateExpiredListing()
    }

  deactivateExpiredListing () {
    cron.schedule('0 0 * * *', async () => {
       await this.listingsRepository.update(
        {expired_at: LessThan(new Date()), active: 'active'},
        {active: 'hidden'}
      )
    });
  }

  async report(id:string, reason:string, userId:string) {
    if (!REPORT_REASONS.includes(reason)) throw new BadRequestException('Нет такого типа жалобы')
    
    await this.reportListingsRepo.save({listingId: id, userId, reason})
    return "ok"
  }

  async createReview(review: string, userId: string, listingId: string) {
    const usersListing = await this.listingsRepository.findOne({ where: { id: listingId, userId } })
    if (usersListing) throw new BadRequestException('Вы не можете оставить отзыв своему обьявлению')

    const alreadyReviewed = await this.reviewListingsRepo.findOne({ where: { listingId, userId } })
    if (alreadyReviewed) throw new BadRequestException('Вы уже оставили отзыв на это обьявление')

    await this.reviewListingsRepo.save({ review, userId, listingId })

    return await this.listingsRepository.findOne({
      where: { id: listingId },
      relations: { images: true, rewies: true },
    })
  }

  async imagesEdit(action: 'add' | 'update' | 'delete', files: Express.Multer.File[],
    userId: string, listingId: string, imageId?: string) {
    await this.isUserListing(userId, listingId)

    if (action === 'add') {
      const uploaded = await uploadImages(files)
      await this.saveListingsImages(uploaded, listingId)
      return 'Изображение добавлено'
    }

    if (action === 'update' && imageId) {
      const image = await this.listingsImagesRepository.findOne({ where: { id: imageId } })
      if (!image) throw new NotFoundException('Изображение не найдено')

      const uploaded = await uploadImages(files)
      if (!uploaded) throw new InternalServerErrorException('Ошибка сервера попробуйте еще раз')

      await this.saveListingsImages(uploaded, listingId)
      await deleteImageFromCloudinary(image.imageKey)
      await this.listingsImagesRepository.delete(imageId)
      return 'Изображение изменено'
    }

    if (action === 'delete' && imageId) {
      const image = await this.listingsImagesRepository.findOne({ where: { id: imageId } })
      if (!image) throw new NotFoundException('Изображение не найдено')

      await deleteImageFromCloudinary(image.imageKey)
      await this.listingsImagesRepository.delete(imageId)
      return 'Изображение удалено'
    }

    throw new BadRequestException('Неопознаный action')
  }

  matchCategories(listing_title: string) {
    const title = listing_title.toLowerCase()
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(word => title.includes(word))) {
        return category
      }
    }
  }

  async sendMessage(listingId: string, buyerId: string, sellerId: string, message: string) {
    return await firstValueFrom(
      this.chatClient.send('chat.created', { listingId, buyerId, sellerId, message }).pipe(timeout(5000))
    )
  }

  async updateListing(dto: CreateListingDto, userId: string, id: string) {
    checkAtributes(dto)
    await this.isUserListing(userId, id)
    const newlisting = this.listingsRepository.create(dto)
    return await this.listingsRepository.update({ id }, newlisting)
  }

  async hiddenListing(id: string, userId: string) {
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({ id }, { active: 'hidden' })
  }

  async activateListing(id: string, userId: string) {
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({ id }, { active: 'active' })
  }

  async updateLikeListing(dto: UdpdateLikeDto) {
    if (dto.make === 'increment') {
      await this.listingsRepository.increment({ id: dto.listingId }, 'likes', 1)
    } else {
      await this.listingsRepository.decrement({ id: dto.listingId }, 'likes', 1)
    }
  }

  async updateChatesListing(dto: UdpdateLikeDto) {
    await this.listingsRepository.increment({ id: dto.listingId }, 'chates', 1)
  }

  async deleteListing(id: string, userId: string) {
    await this.isUserListing(userId, id)
    return await this.listingsRepository.delete({ id })
  }

  // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
  async createTestListing(userId: string, username: string) {
    const testListing = this.listingsRepository.create({
      listing_title: 'Тестовый смартфон iPhone 15 Pro',
      listing_decription: 'Это тестовое объявление создано автоматически для тестирования функционала чата в приложении.',
      listing_location: 'Київ',
      listing_category: 'phones',
      listing_atributes: { brand: 'Apple', condition: 'new', diagonal: '6.1', price: '1000' },
      listing_username: username,
      userId,
    })
    const expired_at = getExpiredAt(30)
    return await this.listingsRepository.save({ ...testListing, expired_at })
  }
  // =============================================================================
}
