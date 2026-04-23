import { IsString } from 'class-validator';

export class UploadChatImageDto {
  @IsString()
  chatId: string;
}
