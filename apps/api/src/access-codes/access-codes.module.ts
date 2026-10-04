import { Module } from '@nestjs/common';
import { AccessCodesService } from './access-codes.service';
import { AccessCodesController } from './access-codes.controller';

@Module({
  providers: [AccessCodesService],
  controllers: [AccessCodesController],
  exports: [AccessCodesService],
})
export class AccessCodesModule {}
