import {
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/page-query.dto';
import { PaymentStatus } from '../../generated/prisma/enums';
export class ListPaymentsDto extends PageQueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  purchaseReference?: string;
}
