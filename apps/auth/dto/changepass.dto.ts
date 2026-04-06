import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ChangePassDto {
    @IsString()
    @IsNotEmpty({message: "Токен подтверждения отсутсвует"})
    token:string

    @IsString()
    @IsNotEmpty({message: "Пароль отсутствует"})
    @MinLength(6, {message: "Минимальная длинна пароля остовляет 6 символов"})
    password:string
}