import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import type { PrismaClient as PrismaClientType } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
dotenv.config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const require = createRequire(
  resolve(process.cwd(), 'test/reports-postgres.e2e-spec.ts'),
);
const { PrismaClient } =
  require('../dist/generated/prisma/client') as typeof import('../src/generated/prisma/client');
const { ReportsService } =
  require('../dist/reports/reports.service') as typeof import('../src/reports/reports.service');
describe.skipIf(process.env.RUN_REPORTING_DB_TESTS !== '1')(
  'database reporting',
  () => {
    const schema = `anka_review_${randomBytes(8).toString('hex')}`;
    let admin: Client;
    let prisma: PrismaClientType;
    let schemaCreated = false;
    let service: InstanceType<typeof ReportsService>;
    const asOf = new Date('2026-10-06T12:00:00Z');
    beforeAll(async () => {
      if (!/^anka_review_[a-f0-9]{16}$/.test(schema))
        throw new Error('Invalid isolated schema');
      admin = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
      await admin.connect();
      await admin.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      // No public fallback: even unqualified SQL must resolve exclusively to this schema.
      await admin.query(`SET search_path TO "${schema}"`);
      const migrations = (
        await readdir('prisma/migrations', { withFileTypes: true })
      )
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        const sql = await readFile(
          resolve('prisma/migrations', migration, 'migration.sql'),
          'utf8',
        );
        await admin.query(sql);
      }
      const adapter = new PrismaPg(
        {
          connectionString: process.env.DATABASE_URL,
          options: `-c search_path=${schema}`,
        },
        { schema },
      );
      prisma = new PrismaClient({ adapter });
      await prisma.$connect();

      service = new ReportsService(prisma as unknown as PrismaService);
    }, 30000);
    afterAll(async () => {
      if (prisma) await prisma.$disconnect();
      if (admin) {
        if (schemaCreated && /^anka_review_[a-f0-9]{16}$/.test(schema))
          await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
      }
    });
    it('returns actual zero totals and complete zero-filled windows for an empty database', async () => {
      const report = await service.overview(asOf);
      expect(report.totals).toEqual({
        purchases: 0,
        revenue: '0.00',
        codesSold: 0,
        availableCodes: 0,
      });
      expect(report.sales.daily).toHaveLength(30);
      expect(report.sales.weekly).toHaveLength(12);
      expect(report.sales.monthly).toHaveLength(12);
      expect(report.sales.daily.every((p) => Number(p.amount) === 0)).toBe(
        true,
      );
      expect(report.summaries.payments.statuses).toEqual({
        PENDING: 0,
        SUCCESSFUL: 0,
        FAILED: 0,
        REFUNDED: 0,
      });
    });
    it('aggregates exact money, all status counts, retries and Lagos calendar boundaries', async () => {
      const plan = await prisma.wifiPackage.create({
        data: { name: 'Reporting test', type: 'DAILY', price: '0.10' },
      });
      await prisma.wifiPackage.create({
        data: {
          name: 'Inactive reporting test',
          type: 'MONTHLY',
          price: '0.20',
          status: 'INACTIVE',
        },
      });
      const customer = await prisma.customer.create({
        data: { phone: '08000000000', email: 'report@example.com' },
      });
      const base = { customerId: customer.id, packageId: plan.id };
      const first = await prisma.purchase.create({
        data: {
          ...base,
          reference: 'REPORT-1',
          amount: '0.10',
          status: 'COMPLETED',
          completedAt: new Date('2026-10-05T23:30:00Z'),
        },
      });
      const second = await prisma.purchase.create({
        data: {
          ...base,
          reference: 'REPORT-2',
          amount: '0.20',
          status: 'COMPLETED',
          completedAt: new Date('2026-09-30T23:30:00Z'),
        },
      });
      await prisma.purchase.create({
        data: {
          ...base,
          reference: 'REPORT-3',
          amount: '999.99',
          status: 'PENDING',
        },
      });
      for (const [index, status] of (
        ['AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED'] as const
      ).entries())
        await prisma.accessCode.create({
          data: { code: `REPORTCODE${index}`, packageId: plan.id, status },
        });
      await prisma.payment.createMany({
        data: [
          {
            purchaseId: first.id,
            reference: 'REPORT-P1',
            provider: 'PAYSTACK',
            status: 'FAILED',
            amount: '0.10',
          },
          {
            purchaseId: first.id,
            reference: 'REPORT-P2',
            provider: 'OPAY',
            status: 'SUCCESSFUL',
            amount: '0.10',
            paidAt: new Date('2026-10-05T23:30:00Z'),
          },
          {
            purchaseId: second.id,
            reference: 'REPORT-P3',
            provider: 'PAYSTACK',
            status: 'SUCCESSFUL',
            amount: '0.20',
            paidAt: new Date('2026-09-30T23:30:00Z'),
          },
          {
            purchaseId: second.id,
            reference: 'REPORT-P4',
            provider: 'MANUAL',
            status: 'SUCCESSFUL',
            amount: '900.00',
            currency: 'USD',
            paidAt: asOf,
          },
          {
            purchaseId: second.id,
            reference: 'REPORT-P5',
            provider: 'PAYSTACK',
            status: 'REFUNDED',
            amount: '0.20',
            paidAt: asOf,
          },
        ],
      });
      const report = await service.overview(asOf);
      expect(report.totals).toEqual({
        purchases: 3,
        revenue: '0.30',
        codesSold: 1,
        availableCodes: 1,
      });
      expect(report.summaries.payments).toEqual({
        total: 5,
        statuses: { PENDING: 0, SUCCESSFUL: 3, FAILED: 1, REFUNDED: 1 },
      });
      expect(report.summaries.packages).toEqual({
        total: 2,
        statuses: { ACTIVE: 1, INACTIVE: 1 },
        averagePrice: '0.15',
      });
      expect(report.packageSales).toEqual([
        { label: 'Reporting test', count: 2 },
      ]);
      for (const kind of ['sales', 'paymentVolume'] as const) {
        expect(
          report[kind].daily.find((p) => p.label === '06 Oct')?.amount,
        ).toBe('0.10');
        expect(
          report[kind].daily.find((p) => p.label === '01 Oct')?.amount,
        ).toBe('0.20');
        expect(
          report[kind].weekly.find((p) => p.label === '05 Oct')?.amount,
        ).toBe('0.10');
        expect(
          report[kind].monthly.find((p) => p.label === 'Oct 2026')?.amount,
        ).toBe('0.30');
      }
    });
  },
);
