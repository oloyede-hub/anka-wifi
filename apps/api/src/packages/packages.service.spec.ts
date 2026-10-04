import { PackagesService } from './packages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PackageStatus, PackageType } from '../generated/prisma/client';
describe('PackagesService', () => {
  it('only lists active packages', async () => {
    const prisma = { wifiPackage: { findMany: vi.fn().mockResolvedValue([]) } };
    await new PackagesService(prisma as unknown as PrismaService).findAll();
    expect(prisma.wifiPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: PackageStatus.ACTIVE } }),
    );
  });
  it('writes prices as Decimal without changing their value', async () => {
    const prisma = { wifiPackage: { create: vi.fn().mockResolvedValue({}) } };
    await new PackagesService(prisma as unknown as PrismaService).create({
      name: 'Daily',
      type: PackageType.DAILY,
      price: 100.25,
    });
    expect(
      prisma.wifiPackage.create.mock.calls[0][0].data.price.toFixed(2),
    ).toBe('100.25');
  });
});
