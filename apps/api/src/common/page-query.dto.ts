import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';
export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset = 0;
}
