import { Controller, Get } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateChatDto } from '../dto/createChatDto.dto';
import { error } from 'console';

@Controller()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}
  //MessagePattern
  @MessagePattern('chat.created')
  async handleChatCreate(@Payload() data: CreateChatDto) {
    
    const chatId = await this.chatsService.createChat(data)
    if (chatId === "Вы не можете написать сами себе") {
      return {error: chatId}
    }
    await this.chatsService.save(data.buyerId, chatId, data.message)
    return chatId
  }

  @MessagePattern('chats.users')
  async handleUsersChats(@Payload() data: {type:"seller" | "buyer", userId:string}) {
    return await this.chatsService.getUserChates(data.userId, data.type)
  }
  
}
