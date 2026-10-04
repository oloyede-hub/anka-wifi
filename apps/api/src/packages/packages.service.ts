import { ListPackagesDto } from './dto/list-packages.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PackageStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}
  create(dto: CreatePackageDto) {
    return this.prisma.wifiPackage.create({
      data: { ...dto, price: new Prisma.Decimal(dto.price.toString()) },
    });
  }
  findAll() {
    return this.prisma.wifiPackage.findMany({
      where: { status: PackageStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }
  findAllAdmin(query: ListPackagesDto) {
    return this.prisma.wifiPackage.findMany({
      where: { status: query.status },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
  async findOne(id: string) {
    const wifiPackage = await this.prisma.wifiPackage.findUnique({
      where: { id, status: PackageStatus.ACTIVE },
    });
    if (!wifiPackage) throw new NotFoundException('Package not found');
    return wifiPackage;
  }
  async update(id: string, dto: UpdatePackageDto) {
    try {
      return await this.prisma.wifiPackage.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.price !== undefined
            ? { price: new Prisma.Decimal(dto.price.toString()) }
            : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException('Package not found');
      throw error;
    }
  }
}
