import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entities/message.entity';
import { ChatsEntity } from '../entities/chat.entity';
import { CreateChatDto } from '../dto/createChatDto.dto';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
     @InjectRepository(ChatsEntity)
    private readonly chatRepo: Repository<ChatsEntity>,
  ) {}

  //Создаем чат
  async createChat(dto:CreateChatDto) {
    const chat = await this.chatRepo.save(dto)
    
    return chat.id
  }
  // Сохраняем сообщение в БД
  async save(userId: string, content: string): Promise<MessageEntity> {
    const msg = this.messageRepo.create({ userId, content });
    return await this.messageRepo.save(msg);
  }

  // Возвращаем последние 50 сообщений
  async getAll(): Promise<MessageEntity[]> {
    return await this.messageRepo.find({
      order: { created_at: 'ASC' },
      take: 50,
    });
  }
}