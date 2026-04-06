import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class GetListingsQueryParams {
    @ApiPropertyOptional()
    @IsOptional()
    category?:string

    @IsString()
    page?:string

    @ApiPropertyOptional()
    @IsIn(['abc', 'created', 'price'])
    @IsOptional()
    sortedBy?: 'abc' | 'created' | 'price'

    @ApiPropertyOptional()
    @IsOptional()
    query?: string

    @ApiPropertyOptional()
    @IsOptional()
    hidden?: string

    @ApiPropertyOptional()
    @IsIn(['ASC', 'DESC'])
    @IsOptional()
    order?:'ASC' | 'DESC'

}