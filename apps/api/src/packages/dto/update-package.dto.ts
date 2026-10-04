import { CreatePackageDto } from './create-package.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdatePackageDto extends PartialType(CreatePackageDto, {
  skipNullProperties: false,
}) {}
