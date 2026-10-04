import { ListAccessCodesDto } from './dto/list-access-codes.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  Header,
} from '@nestjs/common';
import { AccessCodesService } from './access-codes.service';
import {
  CreateAccessCodeDto,
  UpdateAccessCodeDto,
} from './dto/create-access-code.dto';
import { BulkCreateAccessCodesDto } from './dto/bulk-create-access-codes.dto';

@UseGuards(AdminAuthGuard)
@Controller(['access-codes', 'admin/access-codes'])
export class AccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAccessCodeDto) {
    return this.accessCodesService.create(dto);
  }

  @Post('bulk')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  bulkCreate(@Body() dto: BulkCreateAccessCodesDto) {
    return this.accessCodesService.bulkCreate(dto.packageId, dto.codes);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query() query: ListAccessCodesDto) {
    return this.accessCodesService.findAll(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(@Param('id') id: string) {
    return this.accessCodesService.findOne(id);
  }

  @Post(':id/disable')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  disable(@Param('id') id: string) {
    return this.accessCodesService.disable(id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@Param('id') id: string, @Body() dto: UpdateAccessCodeDto) {
    return this.accessCodesService.update(id, dto);
  }
}
