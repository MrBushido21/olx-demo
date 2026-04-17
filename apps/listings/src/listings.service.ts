import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Listings } from '../entities/listings.entity';
import { Repository } from 'typeorm';
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
import { error } from 'console';
import { UploadApiResponse } from 'cloudinary';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listings)
    private listingsRepository: Repository<Listings>,

    @InjectRepository(ListingImages)
    private listingsImagesRepository: Repository<ListingImages>,

   @Inject('LISTINGS_SERVICE')
    private chatClient: ClientProxy,
  ) { }

  //Утилитные методы

  //Првоеряем что обьявление принедлежит пользователю
  async isUserListing(userId: string, id: string) {
    const oldListing = await this.listingsRepository.findOne({ where: { userId, id } })
    if (!oldListing) {
      throw new UnauthorizedException('Вы не имеете права редактировать чужие обьявления')
    }
  }

  //Сохраняем в БД изображения
  async saveListingsImages(uploaded: UploadApiResponse[], listingId: string) {
    await Promise.all(
      uploaded.map(image => this.listingsImagesRepository.save({
        imageUrl: image.url, imageKey:
          image.public_id, listingId
      }))
    )
  }

  //GET

  //Получение обьявлений
  async getListings(userId: string, page: number, params?: GetListingsQueryParams) {
    const active = params?.hidden || 'active'
    const query = this.listingsRepository
      .createQueryBuilder('l')
      .where('l.userId = :userId AND l.active = :active', { userId, active })
    if (params?.query) {
      query.andWhere('similarity(LOWER(l.listing_title), LOWER(:query)) > 0.2', { query: params.query })
    }
    if (params?.category && params?.category !== 'all') {
      query.andWhere('l.listing_category = :category', { category: params.category })
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

  //Получение 1 обьявления
  async getListing(id: string) {
    await this.listingsRepository.increment({ id }, 'views', 1)
    return await this.listingsRepository.findOne({ where: { id } })
  }


  //Получение свои категорий публикаций
  async getMyCategories(userId: string) {
    return this.listingsRepository
      .createQueryBuilder('l')
      .select('DISTINCT l.listing_category', 'category')
      .where('l.userId = :userId', { userId })
      .getRawMany()
  }

  //POST

  //Создаине обьявления
  async postListings(dto: CreateListingDto, userId: string, files: Express.Multer.File[]) {
    //Проверка на все атрибуты
    checkAtributes(dto)
    //Загружаем изображения
    const uploaded = await uploadImages(files)

    const listing = this.listingsRepository.create(dto)
    const expired_at = getExpiredAt(30)
    const listingSaved = await this.listingsRepository.save({ ...listing, userId, expired_at })
    this.saveListingsImages(uploaded, listingSaved.id)

    return listingSaved
  }

  
  //Редактирование изображений
  async imagesEdit(action: "add" | "update" | "delete", files: Express.Multer.File[],
    userId:string, listingId: string, imageId?: string) {
      //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, listingId)

    if (action === 'add') {
      //Загружаем изображения
      const uploaded = await uploadImages(files)
      await this.saveListingsImages(uploaded, listingId)
      return "Изображение добавлено"
    } else if (action === "update" && imageId) {
      //Проверяем что изображение существует
      const image = await this.listingsImagesRepository.findOne({ where: { id: imageId } })
      if (!image) {
        throw new NotFoundException("Изображение не найдено")
      }

      //Загружаем новое изображения
      const uploaded = await uploadImages(files)
      if (!uploaded) {
        console.error(error);
        throw new InternalServerErrorException("Ошибка сервера попробуйте еще раз")
      }
      await this.saveListingsImages(uploaded, listingId)

      //Удаляем старое изображение из облака
      await deleteImageFromCloudinary(image.imageKey)

      //Удаляем старое изображение из БД
      await this.listingsImagesRepository.delete(imageId)

      return "Изображение изменено"
    } else if (action === "delete" && imageId) {
      //Проверяем что изображение существует
      const image = await this.listingsImagesRepository.findOne({ where: { id: imageId } })
      if (!image) {
        console.error(`update image for listing: ${error}`);
        throw new NotFoundException("Изображение не найдено")
      }

      //Удаляем старое изображение из облака
      await deleteImageFromCloudinary(image.imageKey)

      //Удаляем старое изображение из БД
      await this.listingsImagesRepository.delete(imageId)

      return "Изображение удалено"
    }

    throw new BadRequestException("Неопознаный action")
  }

  //Предлогать категорию по названию
  matchCategories(listing_title: string) {
    const title = listing_title.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(word => title.includes(word))) {
        return category;
      }
    }
  }

  //Написать по обьявлению
  async sendMessage(listingId:string, buyerId:string, sellerId:string, message:string) {
    return await firstValueFrom(
      this.chatClient.send('chat.created', {
              listingId,
              buyerId,
              sellerId,
              message
            }).pipe(timeout(5000))
    )
  }


  //PUT

  //Обновление текстовой части обьявления
  async updateListing(dto: CreateListingDto, userId: string, id: string) {
    //Проверка на все атрибуты
    checkAtributes(dto)

    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)

    const newlisting = this.listingsRepository.create(dto)
    return await this.listingsRepository.update({ id }, newlisting)
  }

  //PATCH


  //Скрыть обьявление
  async hiddenListing(id: string, userId: string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({ id }, { active: "hidden" })
  }

  //Активировать обьявление
  async activateListing(id: string, userId: string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    await this.listingsRepository.update({ id }, { active: "active" })
  }

  //Имзенение количества лайков после добавления публикации в избранное
  async updateLikeListing(dto: UdpdateLikeDto) {
    if (dto.make === "increment") {
      await this.listingsRepository.increment({ id: dto.listingId }, 'likes', 1)
    } else {
      await this.listingsRepository.decrement({ id: dto.listingId }, 'likes', 1)
    }
  }

  //Имзенение количества чатов после того как продавцу написали
  async updateChatesListing(dto: UdpdateLikeDto) {
    await this.listingsRepository.increment({ id: dto.listingId }, 'chates', 1)
  }



  // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
  // Создаёт тестовое объявление без изображений напрямую в БД
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

  //DELETE

  //Удаление публикации
  async deleteListing(id: string, userId: string) {
    //Првоеряем что обьявление принедлежит пользователю
    await this.isUserListing(userId, id)
    return await this.listingsRepository.delete({ id })
  }
}
