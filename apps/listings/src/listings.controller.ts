import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import type {Response, Request } from 'express';
import { CreateListingDto } from '../dto/createlisting.dto';
import { getUserId } from '@app/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { UdpdateLikeDto } from '../dto/updateLike.dto';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}
  //MessagePattern
  @EventPattern('listing.updateLike')
    handleUserCreated(@Payload() data: UdpdateLikeDto) {
      return this.listingsService.updateLikeListing(data)
  }

  //GET
  // GET /listings/my-categories
  @Get('my-categories') 
  getCategories(
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    return this.listingsService.getMyCategories(userId)
  }
  // GET /listings?category=clothes&page=1&sorted=abc&order='ASC'
   @Get('my') 
  getListings(
    @Req() req:Request,
    @Query('page') page:string,
    @Query('category') category?:string,
    @Query('sorted') sortedBy?:'abc' | 'created' | 'price',
    @Query('order') order?:'ASC' | 'DESC',
    @Query('query') query?:string,
    @Query('hidden') hidden?:string,
  ) {
    const userId = getUserId(req)
    const params = {
      category,
      sortedBy,
      order,
      query,
      hidden: hidden !== undefined ? 'hidden' : ''
    }
    return this.listingsService.getListings(userId, +page, params)
  }

  @Get(':id')
   getListing(
    @Param('id') id:string
  ) {
    return this.listingsService.getListing(id);
  }

  //POST

  @Post('create')
  async createListings(
    @Body() body: CreateListingDto,
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.postListings(body, userId)
    return 'Обьявление было успешно создано'
  }

  @Post('match-categories') 
  matchCategories(
    @Body() body:{listing_title:string}
  ) {
    return this.listingsService.matchCategories(body.listing_title)
  }

  //PUT

  @Put(':id')
  async updateListing(
    @Param('id') id: string,                                                                             
    @Body() body: CreateListingDto, //такие же поля 
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.updateListing(body, userId, id)
    return "Объявление обновлено успешно" 
  }

  //PATCH
  @Patch('hidden/:id')
  async hiddenListing(
    @Param('id') id:string,
   @Req() req:Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.hiddenListing(id, userId)
    return "Объявление теперь неактивно"
  }

  @Put('activate/:id')
  async activateListing(
    @Param('id') id:string,
   @Req() req:Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.activateListing(id, userId)
    return "Объявление теперь активно"
  }


  //DELETE

  @Delete(':id') 
  async deleteListing(
    @Param('id') id:string,
  @Req() req:Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.deleteListing(id, userId)
    return "Обьявление удалено"
  }
}
