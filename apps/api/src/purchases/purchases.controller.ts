import { AdminUnavailableGuard } from '../common/admin-unavailable.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(dto);
  }

  @Get()
  @UseGuards(AdminUnavailableGuard)
  findAll() {
    return this.purchasesService.findAll();
  }

  @Get(':reference')
  findOne(@Param('reference') reference: string) {
    return this.purchasesService.findOne(reference);
  }
}
