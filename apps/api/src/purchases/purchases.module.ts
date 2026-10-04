import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import {
  PurchasesController,
  AdminPurchasesController,
} from './purchases.controller';

@Module({
  providers: [PurchasesService],
  controllers: [PurchasesController, AdminPurchasesController],
})
export class PurchasesModule {}
