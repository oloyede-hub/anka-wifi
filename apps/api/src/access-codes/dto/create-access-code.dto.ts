import { PartialType } from '@nestjs/mapped-types';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
export class CreateAccessCodeDto {
  @IsString()
  @Length(8, 8)
  @Matches(/^\S{8}$/, {
    message: 'code must be 8 characters without whitespace',
  })
  code: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageId: string;
}
export class UpdateAccessCodeDto extends PartialType(CreateAccessCodeDto, {
  skipNullProperties: false,
}) {}
