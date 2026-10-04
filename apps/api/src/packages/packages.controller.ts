import { ListPackagesDto } from './dto/list-packages.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  Header,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  @Post()
  @UseGuards(AdminAuthGuard)
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
  @UseGuards(AdminAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.update(id, dto);
  }
}

@Controller('admin/packages')
@UseGuards(AdminAuthGuard)
export class AdminPackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query() query: ListPackagesDto) {
    return this.packagesService.findAllAdmin(query);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreatePackageDto) {
    return this.packagesService.create(dto);
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.update(id, dto);
  }
}
