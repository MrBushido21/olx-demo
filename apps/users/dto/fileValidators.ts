import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsFile(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFile',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Multer file object check
          return value && typeof value === 'object' && 'originalname' in value;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid file`;
        },
      },
    });
  };
}