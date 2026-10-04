import {
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/page-query.dto';
import { AccessCodeStatus } from '../../generated/prisma/enums';
export class ListAccessCodesDto extends PageQueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(AccessCodeStatus)
  status?: AccessCodeStatus;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageId?: string;
}
