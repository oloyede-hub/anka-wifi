import { Module } from '@nestjs/common';
import { AccessCodesModule } from '../access-codes/access-codes.module';
import {
  PaymentsController,
  AdminPaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack/paystack.service';

@Module({
  imports: [AccessCodesModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, PaystackService],
})
export class PaymentsModule {}
