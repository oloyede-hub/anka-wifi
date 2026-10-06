import { Module } from '@nestjs/common';
import { AccessCodesModule } from '../access-codes/access-codes.module';
import {
  PaymentsController,
  AdminPaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack/paystack.service';
import { OpayService } from './opay/opay.service';

@Module({
  imports: [AccessCodesModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, PaystackService, OpayService],
})
export class PaymentsModule {}
