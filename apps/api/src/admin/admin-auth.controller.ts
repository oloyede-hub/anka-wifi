import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminIdentity } from './admin-auth.service';
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AdminAuthGuard)
  me(@Req() request: { admin: AdminIdentity }) {
    return request.admin;
  }
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}
