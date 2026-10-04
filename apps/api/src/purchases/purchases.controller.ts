import { ListPurchasesDto } from './dto/list-purchases.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  Query,
  Header,
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
  @Header('Cache-Control', 'no-store')
  @UseGuards(AdminAuthGuard)
  findAll(@Query() query: ListPurchasesDto) {
    return this.purchasesService.findAll(query);
  }

  @Get(':reference')
  findOne(@Param('reference') reference: string) {
    return this.purchasesService.findOne(reference);
  }
}

@Controller('admin/purchases')
@UseGuards(AdminAuthGuard)
export class AdminPurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query() query: ListPurchasesDto) {
    return this.purchasesService.findAll(query);
  }
  @Get(':reference')
  @Header('Cache-Control', 'no-store')
  findOne(@Param('reference') reference: string) {
    return this.purchasesService.findOneAdmin(reference);
  }
}
