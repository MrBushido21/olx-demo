import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UnauthorizedException, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ListingsService } from './listings.service';
import type { Request } from 'express';
import { CreateListingDto } from '../dto/createlisting.dto';
import { getUserId } from '@app/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { UdpdateLikeDto } from '../dto/updateLike.dto';
import { MatchCategoriesDto } from '../dto/match-categories.dto';
import { ImagesEditDto } from '../dto/images-edit.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetListingsQueryParams } from '../dto/getListingsQueryParams.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  // ─── RabbitMQ handlers ───────────────────────────────────────────────────────

  @EventPattern('listing.updateLike')
  handleUpdateLike(@Payload() data: UdpdateLikeDto) {
    return this.listingsService.updateLikeListing(data)
  }

  @MessagePattern('listing.get.favorites')
  handleGetMyFavorites(@Payload() data: { listingsIds: string[] }) {
    return this.listingsService.getMyFavorites(data.listingsIds)
  }

  // =================== TEST ONLY — УДАЛИТЬ ПОСЛЕ ТЕСТИРОВАНИЯ ===================
  @MessagePattern('listing.create.test')
  handleCreateTestListing(@Payload() data: { userId: string; username: string }) {
    return this.listingsService.createTestListing(data.userId, data.username)
  }
  // =============================================================================

  // ─── GET ─────────────────────────────────────────────────────────────────────

  // Public: browse all active listings
  @Get()
  getListings(@Query() params: GetListingsQueryParams) {
    return this.listingsService.getListings(Number(params.page) || 1, params)
  }

  // Auth required: user's own listings (supports hidden filter)
  @Get('my')
  getMyListings(
    @Req() req: Request,
    @Query('page') page: string,
    @Query('category') category?: string,
    @Query('sorted') sortedBy?: 'abc' | 'created' | 'price',
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('query') query?: string,
    @Query('hidden') hidden?: string,
  ) {
    const userId = getUserId(req)
    const params = { category, sortedBy, order, query, hidden: hidden !== undefined ? 'hidden' : '' }
    return this.listingsService.getMyListings(+page, userId, params)
  }

  // Auth required: unique categories of user's own listings
  @Get('my-categories')
  getCategories(@Req() req: Request) {
    const userId = getUserId(req)
    return this.listingsService.getMyCategories(userId)
  }

  // Public: single listing by id
  @Get(':id')
  getListing(@Param('id') id: string) {
    return this.listingsService.getListing(id)
  }

  // ─── POST ────────────────────────────────────────────────────────────────────

  @Post('create')
  @UseInterceptors(FilesInterceptor('images', 5))
  async createListings(
    @Body() body: CreateListingDto,
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = getUserId(req)
    if (!files || files.length === 0) {
      throw new BadRequestException('Должно быть хотя бы одно фото товара')
    }
    await this.listingsService.postListings(body, userId, files)
    return 'Обьявление было успешно создано'
  }

  // Public: suggest category by title
  @Post('match-categories')
  matchCategories(@Body() body: MatchCategoriesDto) {
    return this.listingsService.matchCategories(body.listing_title)
  }

  @Post('images-edit')
  @UseInterceptors(FilesInterceptor('images', 5))
  async imagesEdit(
    @Body() body: ImagesEditDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request
  ) {
    const userId = getUserId(req)
    return await this.listingsService.imagesEdit(body.action, files, userId, body.listingId, body.imageId)
  }

  @Post(':id/chat')
  async createChat(
    @Param('id') listingId: string,
    @Req() req: Request,
    @Body() body: SendMessageDto
  ) {
    const buyerId = getUserId(req)
    const listing = await this.listingsService.getListing(listingId)
    const sellerId = listing?.userId

    if (!sellerId) {
      throw new BadRequestException('Объявление не найдено')
    }
    if (!body?.message?.trim()) {
      throw new BadRequestException('Напишите сообщение')
    }

    const response = await this.listingsService.sendMessage(listingId, buyerId, sellerId, body.message)
    if (response !== 'Вы не можете написать сами себе') {
      await this.listingsService.updateChatesListing({ listingId, make: 'increment', userId: sellerId })
    }
    return response
  }

  @Post(':id/report')
  async report(
    @Param('id') id:string,
    @Body() body: {reason:string},
    @Req() req:Request
  ) {
    const userId = getUserId(req)
    const response = await this.listingsService.report(id, body.reason, userId)
    if (response === "ok") return "Ваша жалоба отправлена"
  }

  @Post(':id/review')
  async createReview(
    @Param('id') id: string,
    @Body() body: { text: string },
    @Req() req: Request
  ) {
    const userId = getUserId(req)
    return this.listingsService.createReview(body.text, userId, id)
  }

  // ─── PUT ─────────────────────────────────────────────────────────────────────

  @Put(':id')
  async updateListing(
    @Param('id') id: string,
    @Body() body: CreateListingDto,
    @Req() req: Request
  ) {
    const userId = getUserId(req)
    await this.listingsService.updateListing(body, userId, id)
    return 'Объявление обновлено успешно'
  }

  @Put('activate/:id')
  async activateListing(@Param('id') id: string, @Req() req: Request) {
    const userId = getUserId(req)
    await this.listingsService.activateListing(id, userId)
    return 'Объявление теперь активно'
  }

  // ─── PATCH ───────────────────────────────────────────────────────────────────

  @Patch('hidden/:id')
  async hiddenListing(@Param('id') id: string, @Req() req: Request) {
    const userId = getUserId(req)
    await this.listingsService.hiddenListing(id, userId)
    return 'Объявление теперь неактивно'
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  async deleteListing(@Param('id') id: string, @Req() req: Request) {
    const userId = getUserId(req)
    await this.listingsService.deleteListing(id, userId)
    return 'Обьявление удалено'
  }
}
