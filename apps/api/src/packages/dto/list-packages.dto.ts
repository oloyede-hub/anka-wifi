import { IsEnum, ValidateIf } from 'class-validator';
import { PageQueryDto } from '../../common/page-query.dto';
import { PackageStatus } from '../../generated/prisma/enums';
export class ListPackagesDto extends PageQueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PackageStatus)
  status?: PackageStatus;
}
