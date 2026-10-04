import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
export class InitializePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9.=-]+$/)
  purchaseReference: string;
}
