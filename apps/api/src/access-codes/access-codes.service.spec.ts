import { AccessCodesService } from './access-codes.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
describe('AccessCodesService', () => {
  it('does not query an undefined package for a code-only update', async () => {
    const prisma = {
      wifiPackage: { findUnique: vi.fn() },
      accessCode: {
        findUnique: vi.fn().mockResolvedValue({ id: 'id' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    await new AccessCodesService(prisma as unknown as PrismaService).update(
      'id',
      { code: '12345678' },
    );
    expect(prisma.wifiPackage.findUnique).not.toHaveBeenCalled();
    expect(prisma.accessCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'AVAILABLE',
          purchase: { is: null },
        }),
      }),
    );
  });
  it('maps a concurrent duplicate insert to HTTP 409', async () => {
    const prisma = {
      wifiPackage: { findUnique: vi.fn().mockResolvedValue({ id: 'pkg' }) },
      accessCode: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '7',
          }),
        ),
      },
    };
    await expect(
      new AccessCodesService(prisma as unknown as PrismaService).create({
        packageId: 'pkg',
        code: '12345678',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('reports both request duplicates and stored duplicates', async () => {
    const prisma = {
      wifiPackage: { findUnique: vi.fn().mockResolvedValue({ id: 'pkg' }) },
      accessCode: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const result = await new AccessCodesService(
      prisma as unknown as PrismaService,
    ).bulkCreate('pkg', ['12345678', '12345678', '87654321']);
    expect(result).toEqual({
      requested: 3,
      created: 1,
      skipped: 2,
      duplicatesInRequest: 1,
      alreadyStored: 1,
    });
  });
});

describe('safe code disabling', () => {
  it('only disables an unused available code with no reservation/sale metadata', async () => {
    const prisma = {
      accessCode: {
        findUnique: vi.fn().mockResolvedValue({ id: 'id' }),
        update: vi.fn().mockResolvedValue({ status: 'DISABLED' }),
      },
    };
    await new AccessCodesService(prisma as unknown as PrismaService).disable(
      'id',
    );
    expect(prisma.accessCode.update).toHaveBeenCalledWith({
      where: {
        id: 'id',
        status: 'AVAILABLE',
        purchase: { is: null },
        reservedAt: null,
        reservationExpiresAt: null,
        soldAt: null,
      },
      data: { status: 'DISABLED' },
    });
  });
  it('rejects a code concurrently reserved or sold before the write', async () => {
    const prisma = {
      accessCode: {
        findUnique: vi.fn().mockResolvedValue({ id: 'id' }),
        update: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('changed', {
            code: 'P2025',
            clientVersion: '7',
          }),
        ),
      },
    };
    await expect(
      new AccessCodesService(prisma as unknown as PrismaService).disable('id'),
    ).rejects.toMatchObject({ status: 409 });
  });
});
