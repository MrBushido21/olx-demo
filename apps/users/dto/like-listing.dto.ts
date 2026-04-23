import { IsString } from 'class-validator';

export class LikeListingDto {
  @IsString()
  listingId: string;
}
