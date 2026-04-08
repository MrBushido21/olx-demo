import { IsEnum, IsString } from "class-validator"

export class UdpdateLikeDto {
    @IsString()
    userId!:string

    @IsString()
    listingId!:string

    @IsEnum(['decrement', 'increment'])
    make!: 'decrement' | 'increment'
}