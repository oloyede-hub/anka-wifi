import { VerifyPaymentParamsDto } from './dto/verify-payment-params.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Header,
  Param,
  Post,
} from '@nestjs/common';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  initialize(@Body() dto: InitializePaymentDto) {
    return this.paymentsService.initialize(dto.purchaseReference);
  }

  @Get('verify/:reference')
  @Header('Cache-Control', 'no-store')
  verify(@Param() params: VerifyPaymentParamsDto) {
    return this.paymentsService.verify(params.reference);
  }
}
