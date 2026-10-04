import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminUnavailableGuard } from '../common/admin-unavailable.guard';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  @Post()
  @UseGuards(AdminUnavailableGuard)
  create(@Body() dto: CreatePackageDto) {
    return this.packagesService.create(dto);
  }
  @Get()
  findAll() {
    return this.packagesService.findAll();
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }
  @Patch(':id')
  @UseGuards(AdminUnavailableGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.update(id, dto);
  }
}
