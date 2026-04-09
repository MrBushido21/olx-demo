import { Body, Controller, Param, Patch, Post, Put, Req, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from '../dto/create-user.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';
import { getUserId } from '@app/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

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

  //POST

  @Post('like')
    async likeListing(
      @Body('listingId') listingId: string,                                                                          
      @Req() req:Request
  ) {
      const userId = getUserId(req)
      const result = await this.usersService.likeListing(listingId, userId)
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
    console.log(file);
    
    const userId = getUserId(req)
    if (!userId) {
      console.error('users/changeuserinfo userId is undefined');   
      throw new UnauthorizedException('Неопознаный пользователь')
    }

    return await this.usersService.changeuserinfo(body, file, userId)
  }
}
