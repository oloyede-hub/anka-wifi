import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
export class CreatePurchaseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must contain 7 to 15 digits with an optional leading +',
  })
  phone: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageId: string;
}
