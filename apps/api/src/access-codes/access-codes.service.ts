import { ListAccessCodesDto } from './dto/list-access-codes.dto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAccessCodeDto,
  UpdateAccessCodeDto,
} from './dto/create-access-code.dto';

@Injectable()
export class AccessCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccessCodeDto) {
    const wifiPackage = await this.prisma.wifiPackage.findUnique({
      where: {
        id: dto.packageId,
      },
    });

    if (!wifiPackage) {
      throw new NotFoundException('Package not found');
    }

    const existingCode = await this.prisma.accessCode.findUnique({
      where: {
        code: dto.code,
      },
    });

    if (existingCode) {
      throw new ConflictException('Access code already exists');
    }

    try {
      return await this.prisma.accessCode.create({
        data: {
          code: dto.code,
          packageId: dto.packageId,
        },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findAll(query = new ListAccessCodesDto()) {
    return this.prisma.accessCode.findMany({
      where: { packageId: query.packageId, status: query.status },
      take: query.limit,
      skip: query.offset,
      include: {
        package: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const accessCode = await this.prisma.accessCode.findUnique({
      where: { id },
      include: {
        package: true,
      },
    });

    if (!accessCode) {
      throw new NotFoundException('Access code not found');
    }

    return accessCode;
  }

  async update(id: string, dto: UpdateAccessCodeDto) {
    await this.findOne(id);

    if (dto.packageId !== undefined) {
      const wifiPackage = await this.prisma.wifiPackage.findUnique({
        where: {
          id: dto.packageId,
        },
      });

      if (!wifiPackage) {
        throw new NotFoundException('Package not found');
      }
    }

    try {
      return await this.prisma.accessCode.update({
        where: {
          id,
          status: 'AVAILABLE',
          purchase: { is: null },
          reservedAt: null,
          reservationExpiresAt: null,
          soldAt: null,
        },
        data: {
          code: dto.code,
          packageId: dto.packageId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new ConflictException(
          'Access code is missing or no longer available for editing',
        );
      this.handleWriteError(error);
    }
  }

  async bulkCreate(packageId: string, codes: string[]) {
    const wifiPackage = await this.prisma.wifiPackage.findUnique({
      where: {
        id: packageId,
      },
    });

    if (!wifiPackage) {
      throw new NotFoundException('Package not found');
    }

    const uniqueCodes = [...new Set(codes)];
    const data = uniqueCodes.map((code) => ({
      code,
      packageId,
    }));

    try {
      const result = await this.prisma.accessCode.createMany({
        data,
        skipDuplicates: true,
      });
      return {
        requested: codes.length,
        created: result.count,
        skipped: codes.length - result.count,
        duplicatesInRequest: codes.length - uniqueCodes.length,
        alreadyStored: uniqueCodes.length - result.count,
      };
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async disable(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.accessCode.update({
        where: {
          id,
          status: 'AVAILABLE',
          purchase: { is: null },
          reservedAt: null,
          reservationExpiresAt: null,
          soldAt: null,
        },
        data: { status: 'DISABLED' },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new ConflictException(
          'Only unused available access codes can be disabled',
        );
      throw error;
    }
  }
  async reserveAvailableCode(
    packageId: string,
    purchaseId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const reserve = async (tx: Prisma.TransactionClient) => {
      // All reservation, initialization and fulfillment paths lock the purchase first.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${purchaseId} FOR UPDATE`,
      );
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { accessCode: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.packageId !== packageId || purchase.status !== 'PENDING')
        throw new ConflictException('Purchase cannot reserve this package');
      const existing = purchase.accessCode;
      const now = new Date();
      if (existing) {
        if (
          existing.packageId !== packageId ||
          existing.status !== 'RESERVED' ||
          !existing.reservationExpiresAt ||
          !existing.reservedAt
        )
          throw new ConflictException(
            'Purchase reservation requires reconciliation',
          );
        if (existing.reservationExpiresAt > now) return existing;
        const unresolved = await tx.payment.findFirst({
          where: { purchaseId, status: { in: ['PENDING', 'SUCCESSFUL'] } },
          select: { id: true },
        });
        if (unresolved)
          throw new ConflictException(
            'Expired reservation has an unresolved payment; verify it before retrying',
          );
        // Release only this purchase's expired reservation when there is no unresolved charge.
        await tx.purchase.update({
          where: { id: purchaseId, accessCodeId: existing.id },
          data: { accessCodeId: null },
        });
        await tx.accessCode.update({
          where: { id: existing.id, status: 'RESERVED' },
          data: {
            status: 'AVAILABLE',
            reservedAt: null,
            reservationExpiresAt: null,
          },
        });
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = await tx.accessCode.findFirst({
          where: {
            packageId,
            status: 'AVAILABLE',
            purchase: { is: null },
            soldAt: null,
            reservedAt: null,
            reservationExpiresAt: null,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (!code)
          throw new ConflictException(
            'No access codes available for this package',
          );
        const claimed = await tx.accessCode.updateMany({
          where: {
            id: code.id,
            packageId,
            status: 'AVAILABLE',
            purchase: { is: null },
            soldAt: null,
            reservedAt: null,
            reservationExpiresAt: null,
          },
          data: {
            status: 'RESERVED',
            reservedAt: now,
            reservationExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          },
        });
        if (claimed.count !== 1) continue;
        await tx.purchase.update({
          where: {
            id: purchaseId,
            status: 'PENDING',
            AND: [{ accessCodeId: null }],
          },
          data: { accessCodeId: code.id },
        });
        return tx.accessCode.findUniqueOrThrow({ where: { id: code.id } });
      }
      throw new ConflictException(
        'Inventory changed during checkout; please retry',
      );
    };
    return transaction
      ? reserve(transaction)
      : this.prisma.$transaction(reserve);
  }
  private handleWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('Access code already exists');
      if (error.code === 'P2003')
        throw new NotFoundException('Package not found');
    }
    throw error;
  }
}
