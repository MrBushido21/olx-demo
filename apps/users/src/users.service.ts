import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entity/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { FavoritesEntity } from '../entity/favorites.entity';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { deleteImageFromCloudinary, uploadImageToCloudinary } from 'libs/common/conf/cloudinary';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,

    @InjectRepository(FavoritesEntity)
    private favoritesRepository: Repository<FavoritesEntity>,

    @Inject('USERS_SERVICE')
    private usersClient: ClientProxy,

    @Inject('CHATS_SERVICE')
    private chatsClient: ClientProxy,

    @Inject('LISTINGS_SERVICE')
    private listingsClient: ClientProxy
  ) { }

  async createUser(dto: CreateUserDto) {
    const user = this.usersRepository.create(dto)
    return await this.usersRepository.save(user)
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } })
    return user
  }
  async findById(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } })
    return user
  }
  async getMe(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } })
    const userInfo = {
      "username": user?.username,
      "email": user?.email,
      "phone": user?.phone,
      "location": user?.location,
      "avatar_url": user?.avatar_url,
      "created_at": user?.created_at
    }
    return userInfo
  }
  async getMyChats(type: string, userId:string) {
    const userChats = await firstValueFrom (
      this.chatsClient.send('chats.users', { userId, type })
        .pipe(timeout(10000))
    )

    return userChats
  }


  async getFavorites(userId:string) {
    const favorites = await this.favoritesRepository.find({where: {userId}, select: {listingId: true}})
    const listingsIds = favorites.map(f => f.listingId)
    return firstValueFrom(
      this.listingsClient.send('listing.get.favorites', {listingsIds}).pipe(timeout(10000))
    )
  }

  async updatePass(id: string, password: string) {
    const user = await this.usersRepository.update({ id }, { password })
    return user
  }

  //change user info

  async changeuserinfo(dto: ChangeUserInfoDto, avatar: Express.Multer.File, userId: string) {
    // Нельзя сохранять пустые данные если были не пустые
    const user = await this.usersRepository.findOne({ where: { id: userId } })

    if (!user) {
      console.error('auth/changeuserinfo/service user is undefined');
      throw new UnauthorizedException('Неопознаный пользователь')
    }

    let uploadResult = { url: "", public_id: "" }
    if (avatar && user.avatar_public_id === null) {
      uploadResult = await uploadImageToCloudinary(avatar);
    } else if (avatar && user.avatar_public_id) {
      //сначала удаляем изображение из клауднари потом загружаем новое фото
      await deleteImageFromCloudinary(user.avatar_public_id)
      uploadResult = await uploadImageToCloudinary(avatar);
    }

    const newUser = {
      username: dto.username ? dto.username : user.username,
      location: dto.location ? dto.location : user.location,
      phone: dto.phone ? dto.phone : user.phone,
      avatar_url: uploadResult.url || user.avatar_url,
      avatar_public_id: uploadResult.public_id || user.avatar_public_id,
    }

    await this.usersRepository.update(userId, newUser)
  }

  async likeListing(listingId: string, userId: string) {
    const favofiteListing = await this.favoritesRepository.findOne({ where: { listingId } })
    if (favofiteListing) {
      await this.favoritesRepository.delete({ listingId })
      await firstValueFrom(
        this.usersClient.emit('listing.updateLike', { userId, listingId, make: 'decrement' })
          .pipe(timeout(10000))
      )
      return 0
    } else {
      await this.favoritesRepository.save({ listingId, userId })
      await firstValueFrom(
        this.usersClient.emit('listing.updateLike', { userId, listingId, make: 'increment' })
          .pipe(timeout(10000))
      )
      return 1
    }
  }
}
