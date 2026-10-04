import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import dotenv from 'dotenv';
import type { PrismaClient as PrismaClientType } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { PaystackService } from '../src/payments/paystack/paystack.service';
import type { InitializePaystackTransaction } from '../src/payments/paystack/paystack.types';

dotenv.config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const require = createRequire(
  resolve(process.cwd(), 'test/payment-postgres.e2e-spec.ts'),
);
const { PrismaClient } =
  require('../dist/generated/prisma/client') as typeof import('../src/generated/prisma/client');
const { AccessCodesService } =
  require('../dist/access-codes/access-codes.service') as typeof import('../src/access-codes/access-codes.service');
const { PaymentsService } =
  require('../dist/payments/payments.service') as typeof import('../src/payments/payments.service');

// Opt in explicitly: this creates/removes only a randomly named isolated test schema.
describe.skipIf(process.env.RUN_PAYMENT_DB_TESTS !== '1')(
  'payment PostgreSQL concurrency and rollback',
  () => {
    const schema = `anka_review_${randomBytes(8).toString('hex')}`;
    let admin: Client;
    let prisma: PrismaClientType;
    let schemaCreated = false;
    let codeSequence = 10000000;
    const initializeTransaction = vi.fn(
      async (input: InitializePaystackTransaction) => ({
        status: true,
        message: '',
        data: {
          reference: input.reference,
          authorization_url: 'https://checkout.paystack.com/test',
          access_code: 'checkout',
        },
      }),
    );
    const verifyTransaction = vi.fn(async (reference: string) => ({
      status: true,
      message: '',
      data: {
        id: 1,
        reference,
        amount: 10025,
        status: 'success',
        currency: 'NGN',
        paid_at: '2026-10-04T09:00:00Z',
        channel: 'card',
      },
    }));
    let service: InstanceType<typeof PaymentsService>;

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
      const codes = new AccessCodesService(prisma as unknown as PrismaService);
      service = new PaymentsService(
        prisma as unknown as PrismaService,
        codes,
        {
          initializeTransaction,
          verifyTransaction,
        } as unknown as PaystackService,
        new ConfigService({ FRONTEND_URL: 'http://localhost:3000' }),
      );
    }, 30000);

    afterAll(async () => {
      if (prisma) await prisma.$disconnect();
      if (admin) {
        // Remove only the schema this test created; existing schemas/data are never touched.
        if (schemaCreated && /^anka_review_[a-f0-9]{16}$/.test(schema))
          await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
      }
    });

    async function fixture(purchases = 1) {
      const wifiPackage = await prisma.wifiPackage.create({
        data: {
          name: 'Isolated review fixture',
          type: 'DAILY',
          price: '100.25',
        },
      });
      const code = await prisma.accessCode.create({
        data: { packageId: wifiPackage.id, code: String(codeSequence++) },
      });
      const references: string[] = [];
      for (let index = 0; index < purchases; index++) {
        const purchase = await prisma.purchase.create({
          data: {
            reference: `ANK-${randomBytes(16).toString('hex')}`,
            amount: '100.25',
            package: { connect: { id: wifiPackage.id } },
            customer: {
              create: { phone: '08012345678', email: 'fixture@example.com' },
            },
          },
        });
        references.push(purchase.reference);
      }
      return { wifiPackage, code, references };
    }

    it('allows only one customer to initialize against a single code', async () => {
      const { code, references } = await fixture(2);
      const results = await Promise.allSettled(
        references.map((reference) => service.initialize(reference)),
      );
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const stored = await prisma.accessCode.findUniqueOrThrow({
        where: { id: code.id },
        include: { purchase: true },
      });
      expect(stored.status).toBe('RESERVED');
      expect(stored.purchase).not.toBeNull();
      expect(
        await prisma.payment.count({
          where: { purchase: { reference: { in: references } } },
        }),
      ).toBe(1);
    });

    it('serializes initialization for the same purchase', async () => {
      const { references } = await fixture();
      const results = await Promise.allSettled([
        service.initialize(references[0]),
        service.initialize(references[0]),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        await prisma.payment.count({
          where: { purchase: { reference: references[0] } },
        }),
      ).toBe(1);
    });

    it('returns identical fulfillment under concurrent verification and later retries', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0]);
      const results = await Promise.all([
        service.verify(initialized.paymentReference),
        service.verify(initialized.paymentReference),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(await service.verify(initialized.paymentReference)).toEqual(
        results[0],
      );
      const stored = await prisma.accessCode.findUniqueOrThrow({
        where: { id: code.id },
        include: { purchase: true },
      });
      expect(stored.status).toBe('SOLD');
      expect(stored.purchase?.status).toBe('COMPLETED');
      expect(stored.reservedAt).toBeNull();
      expect(stored.reservationExpiresAt).toBeNull();
    });

    it('rolls back SOLD/COMPLETED changes if the payment write fails', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0]);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference: initialized.paymentReference },
      });
      await prisma.payment.create({
        data: {
          reference: `PAY-${randomBytes(16).toString('hex')}`,
          providerReference: initialized.paymentReference,
          provider: 'PAYSTACK',
          amount: '100.25',
          status: 'FAILED',
          purchaseId: payment.purchaseId,
        },
      });
      await expect(
        service.verify(initialized.paymentReference),
      ).rejects.toThrow();
      const unchanged = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { purchase: { include: { accessCode: true } } },
      });
      expect(unchanged.status).toBe('PENDING');
      expect(unchanged.purchase.status).toBe('PENDING');
      expect(unchanged.purchase.accessCode?.id).toBe(code.id);
      expect(unchanged.purchase.accessCode?.status).toBe('RESERVED');
      expect(unchanged.purchase.accessCode?.soldAt).toBeNull();
    });
  },
);
