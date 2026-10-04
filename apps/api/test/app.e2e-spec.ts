import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createValidationPipe } from '../src/common/validation';
// Use compiled Nest classes so decorator metadata matches the production build.
const require = createRequire(resolve(process.cwd(), 'test/app.e2e-spec.ts'));
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const {
  PaystackService,
} = require('../dist/payments/paystack/paystack.service');

describe('API HTTP boundaries', () => {
  let app: INestApplication;
  const prisma = {
    wifiPackage: { findMany: vi.fn().mockResolvedValue([]) },
    purchase: { findUnique: vi.fn().mockResolvedValue(null) },
    payment: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PaystackService)
      .useValue({ initializeTransaction: vi.fn(), verifyTransaction: vi.fn() })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ADMIN_JWT_SECRET:
            'test-only-secret-for-admin-authentication-0123456789',
        }),
      )
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('returns a liveness response', async () => {
    await request(app.getHttpServer()).get('/').expect(200, { status: 'ok' });
  });
  it.each([
    ['get', '/access-codes'],
    ['post', '/access-codes'],
    ['post', '/access-codes/bulk'],
    ['patch', '/access-codes/id'],
    ['get', '/access-codes/id'],
    ['get', '/purchases'],
    ['post', '/packages'],
    ['patch', '/packages/id'],
  ])('blocks admin operations: %s %s', async (method, path) => {
    await request(app.getHttpServer())
      [method as 'get' | 'post' | 'patch'](path)
      .send({})
      .expect(401);
  });
  it.each([
    { phone: '08012345678', packageId: 'pkg', amount: 1 },
    { phone: 'invalid', packageId: 'pkg' },
    { phone: '08012345678', packageId: 'pkg' },
    { phone: '08012345678', packageId: 'pkg', email: null },
    { phone: '08012345678', packageId: 'pkg', status: 'COMPLETED' },
  ])('rejects invalid or client-controlled purchase fields', async (body) => {
    await request(app.getHttpServer())
      .post('/purchases')
      .send(body)
      .expect(400);
  });
  it('returns 404 for an unknown reference', async () => {
    await request(app.getHttpServer()).get('/purchases/unknown').expect(404);
  });
  it('uses only the public purchase projection', async () => {
    await request(app.getHttpServer()).get('/purchases/unknown');
    expect(prisma.purchase.findUnique).toHaveBeenLastCalledWith({
      where: { reference: 'unknown' },
      select: {
        reference: true,
        status: true,
        amount: true,
        packageId: true,
        createdAt: true,
        completedAt: true,
      },
    });
  });
});

describe('payment DTO boundaries', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PaystackService)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ADMIN_JWT_SECRET:
            'test-only-secret-for-admin-authentication-0123456789',
        }),
      )
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([
    {},
    { purchaseReference: '' },
    { purchaseReference: 'ANK-test', amount: 1 },
    { purchaseReference: 'ANK-test', status: 'SUCCESSFUL' },
  ])('rejects missing or controlled checkout fields', async (body) => {
    await request(app.getHttpServer())
      .post('/payments/initialize')
      .send(body)
      .expect(400);
  });
});
