import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
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
export class UpdateAccessCodeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(8, 8)
  @Matches(/^\S{8}$/)
  code?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageId?: string;
}
