import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ReconcilePaymentsDto {
  @IsInt()
  @Min(1)
  @Max(5)
  limit = 5;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,128}$/)
  afterId?: string;
}
