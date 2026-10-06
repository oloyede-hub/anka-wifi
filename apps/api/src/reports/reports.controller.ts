import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@UseGuards(AdminAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview() {
    return this.reports.overview();
  }
}
