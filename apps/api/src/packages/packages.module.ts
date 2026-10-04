import { Module } from '@nestjs/common';
import {
  PackagesController,
  AdminPackagesController,
} from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  controllers: [PackagesController, AdminPackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
