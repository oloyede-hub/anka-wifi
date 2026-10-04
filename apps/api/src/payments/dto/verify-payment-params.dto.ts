import { IsString, Matches, MaxLength } from 'class-validator';
export class VerifyPaymentParamsDto {
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9.=-]+$/)
  reference: string;
}
