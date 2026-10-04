import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
describe('PurchasesService', () => {
  function setup(status = 'ACTIVE', inventory: object | null = { id: 'code' }) {
    const tx = {
      wifiPackage: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pkg',
          status,
          price: new Prisma.Decimal('100.25'),
        }),
      },
      accessCode: { findFirst: vi.fn().mockResolvedValue(inventory) },
      customer: { create: vi.fn().mockResolvedValue({ id: 'customer' }) },
      purchase: { create: vi.fn().mockResolvedValue({ status: 'PENDING' }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    return {
      tx,
      service: new PurchasesService(prisma as unknown as PrismaService),
    };
  }
  it('uses the database price and creates a pending purchase without assigning a code', async () => {
    const { tx, service } = setup();
    await service.create({
      packageId: 'pkg',
      phone: '08012345678',
      email: 'customer@example.com',
    });
    const write = tx.purchase.create.mock.calls[0][0];
    expect(write.data.amount.toFixed(2)).toBe('100.25');
    expect(write.data.status).toBe('PENDING');
    expect(write.data.accessCodeId).toBeUndefined();
    expect(write.data.reference).toMatch(/^ANK-\d+-[A-F0-9]{32}$/);
    expect(write.select.customer).toBeUndefined();
    expect(write.select.accessCode).toBeUndefined();
  });
  it.each([
    ['INACTIVE', { id: 'code' }],
    ['ACTIVE', null],
  ])(
    'rejects unavailable packages or inventory before storing customers',
    async (status, inventory) => {
      const { tx, service } = setup(status as string, inventory);
      await expect(
        service.create({
          packageId: 'pkg',
          phone: '08012345678',
          email: 'customer@example.com',
        }),
      ).rejects.toThrow();
      expect(tx.customer.create).not.toHaveBeenCalled();
      expect(tx.purchase.create).not.toHaveBeenCalled();
    },
  );
});
