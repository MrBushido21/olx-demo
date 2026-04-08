import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entity/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { FavoritesEntity } from '../entity/favorites.entity';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,

    @InjectRepository(FavoritesEntity)
    private favoritesRepository: Repository<FavoritesEntity>,

     @Inject('USERS_SERVICE')
      private usersClient: ClientProxy,
  ) { }

  async createUser(dto: CreateUserDto) {
    const user = this.usersRepository.create(dto)
    await this.usersRepository.save(user)
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } })
    return user
  }
  async findById(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } })
    return user
  }
  async updatePass(id: string, password: string) {
    const user = await this.usersRepository.update({ id }, { password })
    return user
  }
  async updateUserInfo(id: string, newUser: CreateUserDto) {
    const user = await this.usersRepository.update({ id }, newUser)
    return user
  }

  //change user info

  async changeuserinfo(dto: ChangeUserInfoDto, userId: string) {
    // Нельзя сохранять пустые данные если были не пустые
    const user = await this.usersRepository.findOne({ where: { id: userId } })

    if (!user) {
      console.error('auth/changeuserinfo/service user is undefined');
      throw new UnauthorizedException('Неопознаный пользователь')
    }
    const newUser = {
      username: dto.username ? dto.username : user.username,
      location: dto.location ? dto.location : user.location,
      phone: dto.phone ? dto.phone : user.phone,
      avatar: dto.avatar ? dto.avatar : user.avatar,
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
