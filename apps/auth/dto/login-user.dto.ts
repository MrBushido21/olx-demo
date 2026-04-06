import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginUserDto {
    @IsEmail({}, {message: "Введите корректный емейл"})
    email: string

    @IsString({message: "Введите пароль"})
    @MinLength(6, {message: "Минимальная длинна пароля составляет 6 символов"})
    password:string
}