import { createHmac } from 'node:crypto';
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
const { OpayService } =
  require('../dist/payments/opay/opay.service') as typeof import('../src/payments/opay/opay.service');

// Opt in explicitly: this creates/removes only a randomly named isolated test schema.
describe.skipIf(process.env.RUN_PAYMENT_DB_TESTS !== '1')(
  'payment PostgreSQL concurrency and rollback',
  () => {
    const schema = `anka_review_${randomBytes(8).toString('hex')}`;
    let admin: Client;
    let prisma: PrismaClientType;
    let schemaCreated = false;
    let codeSequence = 10000000;
    const providerIds = new Map<string, number>();
    function providerId(reference: string) {
      if (!providerIds.has(reference))
        providerIds.set(reference, providerIds.size + 1);
      return providerIds.get(reference)!;
    }
    const orderNo = (reference: string) => `OPAY-${reference}`;
    const opayStatus = new Map<string, string>();
    const opayConfig = {
      OPAY_MERCHANT_ID: '123456789',
      OPAY_PUBLIC_KEY: 'test-public',
      OPAY_PRIVATE_KEY: 'test-private',
      API_URL: 'https://api.example.com',
      FRONTEND_URL: 'http://localhost:3000',
    };
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
        id: providerId(reference),
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
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, options: { body: string }) => {
          const { reference } = JSON.parse(options.body) as {
            reference: string;
          };
          return new Response(
            JSON.stringify({
              code: '00000',
              data: {
                reference,
                orderNo: orderNo(reference),
                amount: { total: 10025, currency: 'NGN' },
                status: url.endsWith('/create')
                  ? 'INITIAL'
                  : (opayStatus.get(reference) ?? 'SUCCESS'),
                cashierUrl: 'https://sandboxcashier.opaycheckout.com/checkout',
              },
            }),
          );
        }),
      );
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
          verifyWebhookSignature: (raw: Buffer, signature?: string) =>
            signature ===
            createHmac('sha512', 'test-provider-secret')
              .update(raw)
              .digest('hex'),
          initializeTransaction,
          verifyTransaction,
        } as unknown as PaystackService,
        new ConfigService(opayConfig),
        new OpayService(new ConfigService(opayConfig)),
      );
    }, 30000);

    afterAll(async () => {
      vi.unstubAllGlobals();
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

    function opayCallback(reference: string) {
      const payload = {
        amount: '10025',
        currency: 'NGN',
        reference,
        refunded: false,
        status: 'SUCCESS',
        timestamp: '2026-10-05T09:00:00Z',
        token: orderNo(reference),
        transactionId: orderNo(reference),
      };
      const canonical = `{Amount:"${payload.amount}",Currency:"${payload.currency}",Reference:"${reference}",Refunded:f,Status:"SUCCESS",Timestamp:"${payload.timestamp}",Token:"${payload.token}",TransactionID:"${payload.transactionId}"}`;
      return Buffer.from(
        JSON.stringify({
          type: 'transaction-status',
          payload,
          sha512: createHmac('sha3-512', opayConfig.OPAY_PRIVATE_KEY)
            .update(canonical)
            .digest('hex'),
        }),
      );
    }

    it('prevents Paystack and OPay from reserving two codes for the same purchase', async () => {
      const { wifiPackage, references } = await fixture();
      await prisma.accessCode.create({
        data: { packageId: wifiPackage.id, code: String(codeSequence++) },
      });
      const outcomes = await Promise.allSettled([
        service.initialize(references[0], 'PAYSTACK'),
        service.initialize(references[0], 'OPAY'),
      ]);
      expect(
        outcomes.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const stored = await prisma.purchase.findUniqueOrThrow({
        where: { reference: references[0] },
        include: { payment: true },
      });
      expect(stored.payment).toHaveLength(1);
      expect(
        await prisma.accessCode.count({
          where: { packageId: wifiPackage.id, status: 'RESERVED' },
        }),
      ).toBe(1);
      expect(
        await prisma.accessCode.count({
          where: { packageId: wifiPackage.id, status: 'AVAILABLE' },
        }),
      ).toBe(1);
    });

    it('fulfills OPay callback and browser verification concurrently exactly once, including duplicates', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0], 'OPAY');
      const raw = opayCallback(initialized.paymentReference);
      await Promise.all([
        service.handleOpayWebhook(raw),
        service.verify(initialized.paymentReference),
        service.handleOpayWebhook(raw),
      ]);
      const stored = await prisma.payment.findUniqueOrThrow({
        where: { reference: initialized.paymentReference },
        include: { purchase: { include: { accessCode: true } } },
      });
      expect(stored).toMatchObject({
        provider: 'OPAY',
        status: 'SUCCESSFUL',
        providerReference: orderNo(initialized.paymentReference),
      });
      expect(stored.purchase).toMatchObject({
        status: 'COMPLETED',
        accessCodeId: code.id,
      });
      expect(stored.purchase.accessCode?.status).toBe('SOLD');
      const soldAt = stored.purchase.accessCode?.soldAt;
      await service.handleOpayWebhook(raw);
      expect(
        (await prisma.accessCode.findUniqueOrThrow({ where: { id: code.id } }))
          .soldAt,
      ).toEqual(soldAt);
      expect(
        await prisma.payment.count({
          where: { purchaseId: stored.purchaseId, status: 'SUCCESSFUL' },
        }),
      ).toBe(1);
    });

    it('reconciles OPay FAIL before permitting a fresh Paystack attempt', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0], 'OPAY');
      opayStatus.set(initialized.paymentReference, 'FAIL');
      await prisma.payment.update({
        where: { reference: initialized.paymentReference },
        data: { createdAt: new Date(Date.now() - 3600000) },
      });
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'released',
      );
      expect(
        (await prisma.accessCode.findUniqueOrThrow({ where: { id: code.id } }))
          .status,
      ).toBe('AVAILABLE');
      const retry = await service.initialize(references[0], 'PAYSTACK');
      expect(retry.paymentReference).not.toBe(initialized.paymentReference);
      await service.verify(retry.paymentReference);
      expect(
        (
          await prisma.purchase.findUniqueOrThrow({
            where: { reference: references[0] },
            include: { payment: true },
          })
        ).payment,
      ).toHaveLength(2);
    });

    it('recovers a lost OPay create response without releasing inventory or starting Paystack', async () => {
      const { code, references } = await fixture();
      vi.mocked(fetch).mockRejectedValueOnce(
        new Error('Lost response after provider acceptance'),
      );
      let reference = '';
      try {
        await service.initialize(references[0], 'OPAY');
      } catch (error) {
        reference = (error as { response: { paymentReference: string } })
          .response.paymentReference;
      }
      expect(reference).toMatch(/^PAY-/);
      const pending = await prisma.payment.findUniqueOrThrow({
        where: { reference },
      });
      expect(pending).toMatchObject({
        provider: 'OPAY',
        status: 'PENDING',
        providerReference: null,
      });
      expect(
        (await prisma.accessCode.findUniqueOrThrow({ where: { id: code.id } }))
          .status,
      ).toBe('RESERVED');
      await expect(
        service.initialize(references[0], 'PAYSTACK'),
      ).rejects.toThrow('unresolved');
      await service.verify(reference);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { reference } }))
          .providerReference,
      ).toBe(orderNo(reference));
      expect(
        (await prisma.accessCode.findUniqueOrThrow({ where: { id: code.id } }))
          .status,
      ).toBe('SOLD');
    });

    it('rolls back OPay fulfillment on a database write failure', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0], 'OPAY');
      await admin.query(
        `CREATE FUNCTION reject_opay_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'SUCCESSFUL' THEN RAISE EXCEPTION 'forced test rollback'; END IF; RETURN NEW; END $$`,
      );
      await admin.query(
        `CREATE TRIGGER reject_opay_success BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION reject_opay_success()`,
      );
      try {
        await expect(
          service.handleOpayWebhook(opayCallback(initialized.paymentReference)),
        ).rejects.toThrow('temporarily unavailable');
        const unchanged = await prisma.payment.findUniqueOrThrow({
          where: { reference: initialized.paymentReference },
          include: { purchase: { include: { accessCode: true } } },
        });
        expect(unchanged.status).toBe('PENDING');
        expect(unchanged.purchase.status).toBe('PENDING');
        expect(unchanged.purchase.accessCodeId).toBe(code.id);
        expect(unchanged.purchase.accessCode?.status).toBe('RESERVED');
        expect(unchanged.purchase.accessCode?.soldAt).toBeNull();
      } finally {
        await admin.query(`DROP TRIGGER reject_opay_success ON "Payment"`);
        await admin.query(`DROP FUNCTION reject_opay_success()`);
      }
      await service.handleOpayWebhook(
        opayCallback(initialized.paymentReference),
      );
      expect(
        (await prisma.accessCode.findUniqueOrThrow({ where: { id: code.id } }))
          .status,
      ).toBe('SOLD');
    });

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

    it.each(['webhook-webhook', 'webhook-manual'])(
      'fulfills only once for simultaneous %s requests',
      async (mode) => {
        const { code, references } = await fixture();
        const initialized = await service.initialize(references[0]);
        const raw = Buffer.from(
          JSON.stringify({
            event: 'charge.success',
            data: { reference: initialized.paymentReference },
          }),
        );
        const signature = createHmac('sha512', 'test-provider-secret')
          .update(raw)
          .digest('hex');
        await Promise.all([
          service.handleWebhook(raw, signature),
          mode === 'webhook-webhook'
            ? service.handleWebhook(raw, signature)
            : service.verify(initialized.paymentReference),
        ]);
        const stored = await prisma.accessCode.findUniqueOrThrow({
          where: { id: code.id },
          include: { purchase: true },
        });
        expect(stored.status).toBe('SOLD');
        expect(stored.purchase?.status).toBe('COMPLETED');
        const soldAt = stored.soldAt;
        expect(await service.handleWebhook(raw, signature)).toEqual({
          received: true,
        });
        expect(
          (
            await prisma.accessCode.findUniqueOrThrow({
              where: { id: code.id },
            })
          ).soldAt,
        ).toEqual(soldAt);
        expect(
          await prisma.payment.count({
            where: { purchaseId: stored.purchase!.id, status: 'SUCCESSFUL' },
          }),
        ).toBe(1);
      },
    );
    it.each([false, true])(
      'reconciles failed payments atomically (forced rollback: %s)',
      async (forceRollback) => {
        const { code, references } = await fixture();
        const initialized = await service.initialize(references[0]);
        await prisma.payment.update({
          where: { reference: initialized.paymentReference },
          data: { createdAt: new Date(Date.now() - 3600000) },
        });
        const normal = await verifyTransaction(initialized.paymentReference);
        verifyTransaction.mockResolvedValueOnce({
          ...normal,
          data: { ...normal.data, status: 'failed' },
        });
        if (forceRollback) {
          await admin.query(
            `CREATE FUNCTION reject_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced test rollback'; END $$`,
          );
          await admin.query(
            `CREATE TRIGGER reject_recovery BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION reject_recovery()`,
          );
        }
        try {
          const result = await service.reconcilePending(5);
          expect(result.outcomes[0].outcome).toBe(
            forceRollback ? 'verification_or_fulfillment_error' : 'released',
          );
          const stored = await prisma.payment.findUniqueOrThrow({
            where: { reference: initialized.paymentReference },
            include: { purchase: true },
          });
          const storedCode = await prisma.accessCode.findUniqueOrThrow({
            where: { id: code.id },
          });
          expect(stored.status).toBe(forceRollback ? 'PENDING' : 'FAILED');
          expect(stored.purchase.accessCodeId).toBe(
            forceRollback ? code.id : null,
          );
          expect(storedCode.status).toBe(
            forceRollback ? 'RESERVED' : 'AVAILABLE',
          );
          if (!forceRollback) await service.initialize(references[0]);
        } finally {
          if (forceRollback) {
            await admin.query(`DROP TRIGGER reject_recovery ON "Payment"`);
            await admin.query(`DROP FUNCTION reject_recovery()`);
          }
        }
      },
    );
    it('rolls back SOLD/COMPLETED changes if the payment write fails', async () => {
      const { code, references } = await fixture();
      const initialized = await service.initialize(references[0]);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { reference: initialized.paymentReference },
      });
      await prisma.payment.create({
        data: {
          reference: `PAY-${randomBytes(16).toString('hex')}`,
          providerReference: String(
            (await verifyTransaction(initialized.paymentReference)).data.id,
          ),
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
