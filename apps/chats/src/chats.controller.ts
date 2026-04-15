import { Controller, Get } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateChatDto } from '../dto/createChatDto.dto';

@Controller()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}
  //MessagePattern
  @MessagePattern('chat.created')
  async handleChatCreate(@Payload() data: CreateChatDto) {
    return await this.chatsService.createChat(data)
  }
  
}
