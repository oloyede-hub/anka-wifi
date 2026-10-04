import { ListPurchasesDto } from './dto/list-purchases.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  AccessCodeStatus,
  PackageStatus,
  Prisma,
  PurchaseStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseDto) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.createPendingPurchase(dto);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Could not generate a unique purchase reference; please retry',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Could not create purchase');
  }

  private createPendingPurchase(dto: CreatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const wifiPackage = await tx.wifiPackage.findUnique({
        where: {
          id: dto.packageId,
        },
      });

      if (!wifiPackage) {
        throw new NotFoundException('Package not found');
      }

      if (wifiPackage.status !== PackageStatus.ACTIVE) {
        throw new BadRequestException('Package is not available');
      }

      // Advisory only: inventory is reserved when payment is initialized.
      const availableCode = await tx.accessCode.findFirst({
        where: {
          packageId: wifiPackage.id,
          status: AccessCodeStatus.AVAILABLE,
        },
        select: { id: true },
      });

      if (!availableCode) {
        throw new ConflictException(
          'No access codes available for this package',
        );
      }

      // Store a contact snapshot per purchase; phone numbers are not verified identities.
      const customer = await tx.customer.create({
        data: {
          phone: dto.phone,
          email: dto.email,
        },
      });

      const reference = this.generateReference();

      return tx.purchase.create({
        data: {
          reference,
          amount: wifiPackage.price,
          status: PurchaseStatus.PENDING,

          customerId: customer.id,
          packageId: wifiPackage.id,
        },

        select: publicPurchaseSelect,
      });
    });
  }

  async findAll(query = new ListPurchasesDto()) {
    return this.prisma.purchase.findMany({
      where: {
        status: query.status,
        reference: query.reference,
        customerId: query.customerId,
        ...(query.phone ? { customer: { phone: query.phone } } : {}),
      },
      take: query.limit,
      skip: query.offset,
      select: adminPurchaseSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(reference: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: {
        reference,
      },
      select: publicPurchaseSelect,
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async findOneAdmin(reference: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { reference },
      select: adminPurchaseSelect,
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }
  private generateReference() {
    const random = randomBytes(16).toString('hex').toUpperCase();

    return `ANK-${Date.now()}-${random}`;
  }
}

const publicPurchaseSelect = {
  reference: true,
  status: true,
  amount: true,
  packageId: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.PurchaseSelect;

const adminPurchaseSelect = {
  ...publicPurchaseSelect,
  id: true,
  customer: { select: { id: true, phone: true, email: true } },
  package: { select: { id: true, name: true, type: true } },
  accessCode: { select: { id: true, code: true, status: true, soldAt: true } },
  payment: {
    select: {
      reference: true,
      status: true,
      provider: true,
      amount: true,
      currency: true,
      paidAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PurchaseSelect;
