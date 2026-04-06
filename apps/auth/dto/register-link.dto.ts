import { IsEmail } from "class-validator";

export class RegisterLinkDto {
    @IsEmail({}, {message: "Введите корректный емейл"})
    email:string
}