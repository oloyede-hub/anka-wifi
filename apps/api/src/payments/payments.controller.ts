import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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
  RawBodyRequest,
  Req,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';
import { ReconcilePaymentsDto } from './dto/reconcile-payments.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  initialize(@Body() dto: InitializePaymentDto) {
    return this.paymentsService.initialize(dto.purchaseReference, dto.provider);
  }

  @Get('verify/:reference')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  verify(@Param() params: VerifyPaymentParamsDto) {
    return this.paymentsService.verify(params.reference);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature')
    signature?: string,
  ) {
    return this.paymentsService.handleWebhook(request.rawBody, signature);
  }

  @Post('opay/webhook')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  opayWebhook(@Req() request: RawBodyRequest<Request>) {
    return this.paymentsService.handleOpayWebhook(request.rawBody);
  }
}

@Controller('admin/payments')
@UseGuards(AdminAuthGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  reconcile(@Body() dto: ReconcilePaymentsDto) {
    return this.paymentsService.reconcilePending(dto.limit, dto.afterId);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query() query: ListPaymentsDto) {
    return this.paymentsService.findAllAdmin(query);
  }
  @Get(':reference')
  @Header('Cache-Control', 'no-store')
  findOne(@Param() params: VerifyPaymentParamsDto) {
    return this.paymentsService.findOneAdmin(params.reference);
  }
}
