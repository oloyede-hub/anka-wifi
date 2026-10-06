import {
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { PaymentProvider } from '../../generated/prisma/client';
export class InitializePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9.=-]+$/)
  purchaseReference: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([PaymentProvider.PAYSTACK, PaymentProvider.OPAY])
  provider: PaymentProvider = PaymentProvider.PAYSTACK;
}
