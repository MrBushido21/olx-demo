import { IsNotEmpty, IsString } from 'class-validator';

export class MatchCategoriesDto {
  @IsString()
  @IsNotEmpty()
  listing_title: string;
}
