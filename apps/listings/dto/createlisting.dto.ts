import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsString, MinLength } from "class-validator";

export class CreateListingDto {
    @IsString()
    @IsNotEmpty({message: 'Название объявления обязательное поле'})
    @MinLength(16, {message: 'Минимальное количество символов названия - 16'})
    listing_title:string
    
    @IsString()
    @IsNotEmpty({message: 'Описание объявления обязательное поле'})
    @MinLength(40, {message: 'Минимальное количество символов описания - 40'})
    listing_decription:string

    @IsString()
    @IsNotEmpty({message: 'Укажите ваше местоположение'})
    listing_location:string

    @IsString()
    @IsNotEmpty({message: 'Укажите категорию'})
    listing_category:string

    @Transform(({ value }) => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  })
  @IsObject()
  @IsNotEmpty({message: 'Заполните поля атрибутов'})
  listing_atributes: Record<string, any>;

    @IsString()
    @IsNotEmpty({message: 'Укажите ваше имя'})
    listing_username:string

    @IsString()
    listing_phone:string
}