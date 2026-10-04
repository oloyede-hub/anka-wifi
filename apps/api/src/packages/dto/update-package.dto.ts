import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PackageStatus, PackageType } from '../../generated/prisma/enums';

// Explicit PATCH DTO: omitted properties are allowed, null and unknown properties are rejected.
export class UpdatePackageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PackageType)
  type?: PackageType;
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(99999999.99)
  price?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PackageStatus)
  status?: PackageStatus;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  featured?: boolean;
}
