import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({message: "Токен идентификации не обнаружен"})
    token:string
    
    @IsString()
    @MinLength(3, {message: 'Имя  пользователя минимум 3 сивола'})
    @IsNotEmpty({message: 'Введите имя пользователя'})
    username: string

    @IsString()
    @MinLength(6, {message: 'Пароль должен быть минимум 6 символов'})
    @IsNotEmpty({message: 'Введите пароль'})
    password:string
}