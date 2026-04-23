import { IsIn, IsOptional, IsString } from 'class-validator';

export class ImagesEditDto {
  @IsIn(['add', 'update', 'delete'])
  action: 'add' | 'update' | 'delete';

  @IsString()
  listingId: string;

  @IsOptional()
  @IsString()
  imageId?: string;
}
