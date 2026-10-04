import { AdminUnavailableGuard } from '../common/admin-unavailable.guard';
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
} from '@nestjs/common';
import { AccessCodesService } from './access-codes.service';
import {
  CreateAccessCodeDto,
  UpdateAccessCodeDto,
} from './dto/create-access-code.dto';
import { BulkCreateAccessCodesDto } from './dto/bulk-create-access-codes.dto';

@UseGuards(AdminUnavailableGuard)
@Controller('access-codes')
export class AccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAccessCodeDto) {
    return this.accessCodesService.create(dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  bulkCreate(@Body() dto: BulkCreateAccessCodesDto) {
    return this.accessCodesService.bulkCreate(dto.packageId, dto.codes);
  }

  @Get()
  findAll() {
    return this.accessCodesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accessCodesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccessCodeDto) {
    return this.accessCodesService.update(id, dto);
  }
}
