import { IsNotEmpty, IsString } from "class-validator";

export class ChangeUserInfoDto {
    @IsString()
    @IsNotEmpty({message: "Заполните поле 'Имя' оно обязательно"})
    username!:string

    @IsString()
    location?:string

    @IsString()
    phone?:string

    @IsString()
    avatar?:string
}