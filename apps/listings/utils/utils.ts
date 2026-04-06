import { BadRequestException } from "@nestjs/common";
import { CATEGORY_FIELDS } from "../conf/categories.config";
import { CreateListingDto } from "../dto/createlisting.dto";

//Проверяет что все атрибуты для категории соблюдены
export const checkAtributes = (dto: CreateListingDto) => {
    const fields = CATEGORY_FIELDS[dto.listing_category];

    if (!fields) {
        throw new BadRequestException('Неизвестная категория');
    }

    for (const field of fields) {
        const value = dto.listing_atributes[field.name];

        // проверяем обязательные поля
        if (field.required && (value === undefined || value === null || value === '')) {
            throw new BadRequestException(`Поле "${field.name}" обязательно`);
        }

        // проверяем enum значения
        if (field.type === 'enum' && value && !field.values.includes(value)) {
            throw new BadRequestException(`Поле "${field.name}" должно быть одним из: ${field.values.join(', ')}`);
        }
    }
}

