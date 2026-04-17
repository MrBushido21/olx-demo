import { IsString } from "class-validator";

export class CreateChatDto {
    @IsString()
    listingId!: string
    @IsString()
    buyerId!: string;
    @IsString()
    sellerId!: string;
    @IsString()
    message!: string;
}