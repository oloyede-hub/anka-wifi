import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthController } from './admin-auth.controller';
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AdminAuthService, AdminAuthGuard],
  controllers: [AdminAuthController],
  exports: [AdminAuthGuard, AdminAuthService],
})
export class AdminModule {}
