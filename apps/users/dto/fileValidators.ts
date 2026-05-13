import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: Express.Multer.File) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('Допустимые форматы: JPEG, PNG, WEBP')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('Максимальный размер файла 5MB')
  }
}

export function validateImageFiles(files: Express.Multer.File[]) {
  files.forEach(file => validateImageFile(file))
}

export function IsFile(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFile',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return (
            value &&
            typeof value === 'object' &&
            'originalname' in value &&
            ALLOWED_MIME_TYPES.includes(value.mimetype) &&
            value.size <= MAX_FILE_SIZE
          )
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid image (JPEG/PNG/WEBP, max 5MB)`;
        },
      },
    });
  };
}