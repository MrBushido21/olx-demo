import { Body, Controller, Patch, Post, Put, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from '../dto/create-user.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { getUserId } from '@app/common';
import type { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern('user.created')
  handleUserCreated(@Payload() data: CreateUserDto) {
    return this.usersService.createUser(data)
  }
  @MessagePattern('user.findByEmail')
  handleUserFindByEmail(@Payload() data: {email:string}) {
    return this.usersService.findByEmail(data.email)
  }
  @MessagePattern('user.findById')
  handleUserFindById(@Payload() data: {id:string}) {
    return this.usersService.findById(data.id)
  }
  @MessagePattern('user.updatePass')
  handleUserUpdatePass(@Payload() data: {id:string, password:string}) {
    return this.usersService.updatePass(data.id, data.password)
  }
  @MessagePattern('user.updateUserInfo')
  handleUserUpdateUserInfo(@Payload() data: {id:string, newUser:CreateUserDto}) {
    return this.usersService.updateUserInfo(data.id, data.newUser)
  }

    @Patch('changeuserinfo')  
  async changeuserinfo(
    @Body() body:ChangeUserInfoDto,
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    if (!userId) {
      console.error('auth/changeuserinfo userId is undefined');   
      throw new UnauthorizedException('Неопознаный пользователь')
    }
    await this.usersService.changeuserinfo(body, userId)
    return "Данные упешно обновлены"
  }
}
