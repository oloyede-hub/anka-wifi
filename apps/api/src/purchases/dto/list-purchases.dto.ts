import {
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/page-query.dto';
import { PurchaseStatus } from '../../generated/prisma/enums';
export class ListPurchasesDto extends PageQueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  reference?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  customerId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  phone?: string;
}
