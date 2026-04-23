import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entities/message.entity';
import { ChatsEntity } from '../entities/chat.entity';
import { CreateChatDto } from '../dto/createChatDto.dto';
import { uploadImageToCloudinary } from 'libs/common/conf/cloudinary';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(ChatsEntity)
    private readonly chatRepo: Repository<ChatsEntity>,

  ) { }

  async getMessage(messageId: string) {
    return await this.messageRepo.findOne({where: {id: messageId}})
  }

  //Достать чат юзера
  async getUserChate(id: string, chatId: string) {
    return await this.chatRepo.findOne({
      where: [
        { id: chatId, buyerId: id },
        { id: chatId, sellerId: id }
      ]
    })
  }
  //Достать чаты юзера
  async getUserChates(id: string, type: "seller" | "buyer") {
    if (type === 'buyer') {
      return await this.chatRepo.find({ where: { buyerId: id } })
    } else if (type === 'seller') {
      return await this.chatRepo.find({ where: { sellerId: id } })
    } else {
      return 'Тип чатов не определен'
    }
  }

  //Создаем чат
  async createChat(dto: CreateChatDto) {
    if (dto.buyerId === dto.sellerId) {
      return 'Вы не можете написать сами себе'
    }

    const existing = await this.chatRepo.findOne({
      where: { buyerId: dto.buyerId, sellerId: dto.sellerId, listingId: dto.listingId }
    })
    if (existing) return existing.id

    const chat = await this.chatRepo.save({ buyerId: dto.buyerId, listingId: dto.listingId, sellerId: dto.sellerId })

    return chat.id
  }
  // Сохраняем сообщение в БД
  async save(userId: string, chatId: string, content: string): Promise<MessageEntity> {
    const msg = this.messageRepo.create({ userId, chatId, content });
    return await this.messageRepo.save(msg);
  }

  // Возвращаем последние 50 сообщений (текст + фото, фото отличается наличием public_id)
  async getAll(chatId: string) {
    return await this.messageRepo.find({
      where: { chatId },
      order: { created_at: 'ASC' },
      take: 50,
    })
  }

  async uploadImg(file: Express.Multer.File, userId: string, chatId: string) {
    // Проверяем что пользователь является участником чата
    const chat = await this.getUserChate(userId, chatId)
    if (!chat) {
      throw new BadRequestException('У вас нет доступа к этому чату')
    }

    const uploadResult = await uploadImageToCloudinary(file)

    try {
      // save() возвращает сохранённую запись с id — один запрос вместо двух
      const saved = await this.messageRepo.save({
        userId,
        chatId,
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      })
      return saved.id
    } catch (error) {
      console.error('saved message img in DB error ' + error)
      throw new InternalServerErrorException('Случилась ошибка при загрузке фото попробуйте еще раз')
    }
  }

  async updateMessageContent(messageId: string, content: string) {
    await this.messageRepo.update({ id: messageId }, { content })
  }
}