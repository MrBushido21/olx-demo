import { IsString } from "class-validator";

export class UserInfoJWT {
    @IsString()
    id:string
    @IsString()
    username:string
    
}