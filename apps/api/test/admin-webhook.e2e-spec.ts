import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation';
import { hashPassword } from '../src/admin/password';
const require = createRequire(
  resolve(process.cwd(), 'test/admin-webhook.e2e-spec.ts'),
);
const { AppModule } =
  require('../dist/app.module') as typeof import('../src/app.module');
const { PrismaService } =
  require('../dist/prisma/prisma.service') as typeof import('../src/prisma/prisma.service');

const jwtSecret = 'test-only-admin-jwt-secret-'.repeat(3);
const paystackSecret = 'test-only-provider-secret';
function signature(raw: string) {
  return createHmac('sha512', paystackSecret).update(raw).digest('hex');
}

describe('admin and webhook HTTP security', () => {
  let app: INestApplication;
  let token: string;
  let passwordHash: string;
  const prisma = {
    admin: {
      findUnique: vi.fn(
        async ({
          where,
          select,
        }: {
          where: { email?: string; id?: string };
          select?: object;
        }) => {
          if (where.email !== 'admin@example.com' && where.id !== 'admin-id')
            return null;
          return {
            id: 'admin-id',
            name: 'Admin',
            email: 'admin@example.com',
            ...(select ? {} : { passwordHash }),
          };
        },
      ),
    },
    wifiPackage: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'pkg' }),
      update: vi.fn().mockResolvedValue({ id: 'pkg', status: 'INACTIVE' }),
    },
    accessCode: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'code' }),
      update: vi.fn().mockResolvedValue({ id: 'code', status: 'DISABLED' }),
    },
    purchase: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  beforeAll(async () => {
    passwordHash = await hashPassword('Strong-test-password!');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ADMIN_JWT_SECRET: jwtSecret,
          PAYSTACK_SECRET_KEY: paystackSecret,
          FRONTEND_URL: 'http://localhost:3000',
        }),
      )
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    token = new JwtService().sign(
      {},
      {
        secret: jwtSecret,
        issuer: 'anka-wifi',
        audience: 'anka-admin',
        subject: 'admin-id',
        expiresIn: 3600,
      },
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(new Error('Real provider HTTP must not be called')),
    );
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });
  it('accepts a valid login, normalizes email, and never returns hashes', async () => {
    const result = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: ' ADMIN@EXAMPLE.COM ', password: 'Strong-test-password!' })
      .expect(200);
    expect(result.body).toMatchObject({
      tokenType: 'Bearer',
      admin: { id: 'admin-id' },
    });
    expect(JSON.stringify(result.body)).not.toContain('passwordHash');
    expect(JSON.stringify(result.body)).not.toContain(passwordHash);
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('returns the same error for a wrong password and unknown email', async () => {
    const first = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
    const second = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'unknown@example.com', password: 'wrong' })
      .expect(401);
    expect(first.body).toEqual(second.body);
    expect(first.body.message).toBe('Invalid credentials');
  });
  it('rejects mass-assignment fields at login', async () => {
    await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong', role: 'admin' })
      .expect(400);
  });
  it('throttles brute-force login requests', async () => {
    await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(429);
  });
  it.each([
    '/admin/packages',
    '/admin/access-codes',
    '/admin/purchases',
    '/admin/payments',
  ])(
    'rejects missing/invalid JWT for %s and accepts admin JWT',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    },
  );
  it('rejects a signed token whose subject is not an administrator', async () => {
    const customerToken = new JwtService().sign(
      {},
      {
        secret: jwtSecret,
        issuer: 'anka-wifi',
        audience: 'anka-admin',
        subject: 'customer-id',
        expiresIn: 3600,
      },
    );
    await request(app.getHttpServer())
      .get('/admin/packages')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(401);
  });
  it('validates management filters and bounds pagination', async () => {
    await request(app.getHttpServer())
      .get(
        '/admin/access-codes?packageId=pkg&status=AVAILABLE&limit=10&offset=2',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(prisma.accessCode.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { packageId: 'pkg', status: 'AVAILABLE' },
        take: 10,
        skip: 2,
      }),
    );
    await request(app.getHttpServer())
      .get('/admin/access-codes?status=INVALID')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/admin/payments?limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/admin/packages?passwordHash=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
  it('allows admin package mutation and blocks unauthenticated callers', async () => {
    const body = { name: 'Daily', type: 'DAILY', price: 100.25 };
    await request(app.getHttpServer())
      .post('/admin/packages')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/admin/packages')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .patch('/admin/packages/pkg')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/admin/access-codes/code/disable')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
  it('keeps customer endpoints accessible without JWT', async () => {
    await request(app.getHttpServer()).get('/packages').expect(200);
    await request(app.getHttpServer()).post('/purchases').send({}).expect(400);
    await request(app.getHttpServer())
      .post('/payments/initialize')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/payments/verify/PAY-unknown')
      .expect(404);
  });
  it.each([
    undefined,
    'bad',
    'a'.repeat(127),
    'z'.repeat(128),
    '0'.repeat(128),
  ])(
    'rejects missing/malformed/invalid webhook signature %s safely',
    async (header) => {
      const call = request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json');
      if (header !== undefined) call.set('x-paystack-signature', header);
      await call
        .send('{"event":"charge.success","data":{"reference":"PAY-test"}}')
        .expect(401);
    },
  );
  it('authenticates exact raw bytes and requires no admin JWT', async () => {
    const raw = '{  "event": "unsupported", "data": {} }';
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature(raw))
      .send(raw)
      .expect(200, { received: true });
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature(JSON.stringify(JSON.parse(raw))))
      .send(raw)
      .expect(401);
  });
  it('acknowledges unknown signed payments without leaking details', async () => {
    const raw = '{"event":"charge.success","data":{"reference":"PAY-unknown"}}';
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature(raw))
      .send(raw)
      .expect(200, { received: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('does not throttle valid webhook deliveries', async () => {
    const raw = '{"event":"unsupported"}';
    for (let count = 0; count < 35; count++)
      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', signature(raw))
        .send(raw)
        .expect(200);
  });
  it('rejects invalid supported-event payload shape', async () => {
    const raw = '{"event":"charge.success","data":[]}';
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature(raw))
      .send(raw)
      .expect(400);
  });
});
