import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from '../dto/create-user.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { getUserId } from '@app/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { LikeListingDto } from '../dto/like-listing.dto';

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

  //GET

  @Get('me')
  async getMe(@Req() req:Request) {
    const userId = getUserId(req)
    return await this.usersService.getMe(userId)
  }

  @Get('me/chats')
  async getMyCahts(
    @Req() req:Request,
    @Query('type') type: "seller" | "buyer" 
  ) {
    const userId = getUserId(req)
    return await this.usersService.getMyChats(type, userId)
  }

  @Get('favorites') 
  getFavorites(
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    return this.usersService.getFavorites(userId)
  }

  //POST
  
  @Post('like')
    async likeListing(
      @Body() body: LikeListingDto,
      @Req() req:Request
  ) {
      const userId = getUserId(req)
      const result = await this.usersService.likeListing(body.listingId, userId)
      return result ? "Вы добавили в понравившееся" : "Вы убрали из понравившегося"
    }

  //PATCH

    @Patch('changeuserinfo')  
    @UseInterceptors(FileInterceptor('avatar'))
  async changeuserinfo(
    @Body() body:ChangeUserInfoDto,
    @Req() req:Request,
    @UploadedFile() file: Express.Multer.File
  ) {
    
    const userId = getUserId(req)
    if (!userId) {
      console.error('users/changeuserinfo userId is undefined');   
      throw new UnauthorizedException('Неопознаный пользователь')
    }

    return await this.usersService.changeuserinfo(body, file, userId)
  }
}
