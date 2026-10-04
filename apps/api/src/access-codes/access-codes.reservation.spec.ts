import { AccessCodesService } from './access-codes.service';
import { Prisma, AccessCodeStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function setup() {
  const code = {
    id: 'code',
    packageId: 'pkg',
    status: AccessCodeStatus.RESERVED,
    reservedAt: new Date(),
    reservationExpiresAt: new Date(Date.now() - 1000),
  };
  const purchase = {
    id: 'purchase',
    packageId: 'pkg',
    status: 'PENDING',
    accessCode: null as typeof code | null,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    purchase: {
      findUnique: vi.fn().mockResolvedValue(purchase),
      update: vi.fn().mockResolvedValue({}),
    },
    accessCode: {
      findFirst: vi.fn().mockResolvedValue(code),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue(code),
    },
    payment: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    service: new AccessCodesService(prisma as unknown as PrismaService),
    tx,
    purchase,
    code,
    prisma,
  };
}
describe('access-code reservations', () => {
  it('retries a lost inventory race with a bounded number of conditional claims', async () => {
    const { service, tx } = setup();
    tx.accessCode.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.reserveAvailableCode('pkg', 'purchase');
    expect(tx.accessCode.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.accessCode.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.purchase.update).toHaveBeenCalledOnce();
    expect(tx.accessCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'AVAILABLE',
          packageId: 'pkg',
        }),
      }),
    );
  });
  it('gives up after three lost claims without attaching inventory', async () => {
    const { service, tx } = setup();
    tx.accessCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.reserveAvailableCode('pkg', 'purchase'),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.accessCode.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.purchase.update).not.toHaveBeenCalled();
  });
  it('does not release an expired reservation with an unresolved payment', async () => {
    const { service, tx, purchase, code } = setup();
    purchase.accessCode = code;
    tx.payment.findFirst.mockResolvedValue({ id: 'payment' });
    await expect(
      service.reserveAvailableCode('pkg', 'purchase'),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.accessCode.update).not.toHaveBeenCalled();
    expect(tx.purchase.update).not.toHaveBeenCalled();
  });
  it('releases and detaches an expired reservation without unresolved payments', async () => {
    const { service, tx, purchase, code } = setup();
    purchase.accessCode = code;
    await service.reserveAvailableCode('pkg', 'purchase');
    expect(tx.purchase.update.mock.calls[0][0].data).toEqual({
      accessCodeId: null,
    });
    expect(tx.accessCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'AVAILABLE',
          reservedAt: null,
          reservationExpiresAt: null,
        },
      }),
    );
  });
  it('uses the caller transaction so reservation and payment creation commit together', async () => {
    const { service, tx, prisma } = setup();
    await service.reserveAvailableCode(
      'pkg',
      'purchase',
      tx as unknown as Prisma.TransactionClient,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
});
