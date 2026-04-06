import { BadRequestException, Body, Controller, Delete, Get, InternalServerErrorException, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../dto/create-user.dto';
import type { Response, Request } from 'express';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterLinkDto } from '../dto/register-link.dto';
import { ChangePassDto } from '../dto/changepass.dto';
import { ChangeUserInfoDto } from '../dto/changeuserinfo.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('register-link')
  async registerLink(
    @Body() body:RegisterLinkDto
  ) {
    return this.authService.registerLink(body.email)
  }
  @Post('register')

  async register( 
    @Body() data: CreateUserDto,
    @Res() res: Response
  ) {
    const tokens = await this.authService.register(data);
    res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
      })
    return res.json({ access_token: tokens.access_token })
  }

  @Post('login')
  async login(
    @Body() data: LoginUserDto,
    @Res() res: Response
  ) {
    const tokens = await this.authService.login(data);
    res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
      })
    return res.json({ access_token: tokens.access_token })
  }

  @Post('reset')
  async reset(
    @Body() body:RegisterLinkDto
  ) {
    await this.authService.reset(body.email)
    return  "Вам на електронную мочту выслали ссылку для смены пароля"
  }

  @Post("changepassword") 
  async changepass (
    @Body() body: ChangePassDto,
    @Res() res: Response
  ) {


    const tokens = await this.authService.changepass(body);
    if (!tokens) {
      throw new InternalServerErrorException("Чтото пошло не так повторите попытку")
    }
    res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
      })
    return res.json({ message: "Пароль успешно обновлен", access_token: tokens.access_token })
  }

  @Delete('logout')
   async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['refresh_token']                                                    
    await this.authService.logout(refreshToken)
    res.clearCookie('refresh_token')
    return res.json({ message: 'Выход выполнен' })
  }
} 
