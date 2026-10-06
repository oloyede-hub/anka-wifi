import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessCodesService } from '../access-codes/access-codes.service';
import { PaystackService } from './paystack/paystack.service';
import { OpayService } from './opay/opay.service';
import {
  AccessCodeStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PurchaseStatus,
} from '../generated/prisma/client';

function setup() {
  const code = {
    id: 'code',
    code: '12345678',
    packageId: 'pkg',
    status: AccessCodeStatus.RESERVED as AccessCodeStatus,
    reservedAt: new Date(),
    reservationExpiresAt: new Date(Date.now() + 600000),
    soldAt: null as Date | null,
  };
  const purchase = {
    id: 'purchase',
    reference: 'ANK-test',
    status: PurchaseStatus.PENDING as PurchaseStatus,
    packageId: 'pkg',
    amount: new Prisma.Decimal('100.25'),
    accessCodeId: code.id,
    accessCode: code,
    completedAt: null as Date | null,
    package: { id: 'pkg', name: 'Daily', status: 'ACTIVE' },
    customer: { email: 'customer@example.com', phone: '08012345678' },
  };
  const payment = {
    id: 'payment',
    reference: 'PAY-test',
    status: PaymentStatus.PENDING as PaymentStatus,
    amount: new Prisma.Decimal('100.25'),
    currency: 'NGN',
    provider: PaymentProvider.PAYSTACK as PaymentProvider,
    providerReference: null as string | null,
    purchaseId: purchase.id,
    purchase,
    paidAt: null as Date | null,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    purchase: {
      findUnique: vi.fn().mockResolvedValue(purchase),
      update: vi.fn(async ({ data }) => Object.assign(purchase, data)),
    },
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      findUniqueOrThrow: vi.fn().mockResolvedValue(payment),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }) => ({ ...payment, ...data })),
      update: vi.fn(async ({ data }) => Object.assign(payment, data)),
    },
    accessCode: {
      updateMany: vi.fn(async ({ data }) => {
        Object.assign(code, data);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const codes = { reserveAvailableCode: vi.fn().mockResolvedValue(code) };
  const verified = {
    id: 1,
    status: 'success',
    reference: payment.reference,
    amount: 10025,
    currency: 'NGN',
    paid_at: '2026-10-04T09:00:00Z',
    channel: 'card',
  };
  const paystack = {
    initializeTransaction: vi.fn().mockResolvedValue({
      data: { authorization_url: 'https://checkout.paystack.com/test' },
    }),
    verifyTransaction: vi.fn().mockResolvedValue({ data: verified }),
    verifyWebhookSignature: vi.fn().mockReturnValue(true),
  };
  const opayVerified = {
    provider: PaymentProvider.OPAY,
    merchantReference: payment.reference,
    providerReference: 'opay-order-1',
    amount: 10025,
    currency: 'NGN',
    status: 'success',
    paidAt: null,
  };
  const opay = {
    configuration: vi.fn(),
    initializeTransaction: vi.fn(async (input) => {
      payment.reference = input.reference;
      payment.provider = PaymentProvider.OPAY;
      opayVerified.merchantReference = input.reference;
      return {
        authorizationUrl: 'https://sandboxcashier.opaycheckout.com/checkout',
        providerReference: 'opay-order-1',
      };
    }),
    queryTransaction: vi.fn().mockResolvedValue(opayVerified),
    authenticateCallback: vi.fn().mockReturnValue({
      type: 'transaction-status',
      payload: {
        reference: payment.reference,
        status: 'SUCCESS',
        refunded: false,
      },
    }),
  };
  const config = new ConfigService({
    FRONTEND_URL: 'http://localhost:3000',
    API_URL: 'https://api.example.com',
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    codes as unknown as AccessCodesService,
    paystack as unknown as PaystackService,
    config,
    opay as unknown as OpayService,
  );
  return {
    service,
    payment,
    purchase,
    code,
    tx,
    prisma,
    paystack,
    codes,
    config,
    verified,
    opay,
    opayVerified,
  };
}

describe('PaymentsService', () => {
  it.each([null, 'PAY-test'])(
    'stores Paystack transaction ID while accepting legacy merchant reference %s',
    async (legacyReference) => {
      const { service, payment } = setup();
      payment.providerReference = legacyReference;
      await service.verify(payment.reference);
      expect(payment.providerReference).toBe('1');
    },
  );
  it('rejects a different stored Paystack transaction ID before fulfillment', async () => {
    const { service, payment, tx } = setup();
    payment.providerReference = '999';
    await expect(service.verify(payment.reference)).rejects.toThrow(
      'does not match',
    );
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
  it('rejects missing OPay configuration before reserving inventory', async () => {
    const { service, opay, codes, tx } = setup();
    opay.configuration.mockImplementation(() => {
      throw new Error('not configured');
    });
    await expect(
      service.initialize('ANK-test', PaymentProvider.OPAY),
    ).rejects.toThrow('not configured');
    expect(codes.reserveAvailableCode).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it('initializes OPay with trusted amount and stores the actual order number', async () => {
    const { service, opay, payment, paystack } = setup();
    const result = await service.initialize('ANK-test', PaymentProvider.OPAY);
    expect(result).toMatchObject({
      provider: 'OPAY',
      authorizationUrl: 'https://sandboxcashier.opaycheckout.com/checkout',
    });
    expect(opay.initializeTransaction.mock.calls[0][0]).toMatchObject({
      amount: 10025,
      email: 'customer@example.com',
      phone: '08012345678',
      callbackUrl: 'https://api.example.com/payments/opay/webhook',
    });
    expect(payment.providerReference).toBe('opay-order-1');
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
  });
  it('keeps an uncertain OPay initialization pending and returns a recovery reference', async () => {
    const { service, opay, tx, code } = setup();
    opay.initializeTransaction.mockRejectedValue(new Error('timeout'));
    await expect(
      service.initialize('ANK-test', PaymentProvider.OPAY),
    ).rejects.toMatchObject({
      response: { paymentReference: expect.stringMatching(/^PAY-/) },
    });
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({
      status: 'PENDING',
      provider: 'OPAY',
    });
    expect(code.status).toBe('RESERVED');
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
  it.each(['pending', 'failed'])('does not fulfill OPay %s', async (status) => {
    const { service, payment, opayVerified, tx } = setup();
    payment.provider = PaymentProvider.OPAY;
    opayVerified.status = status;
    await expect(service.verify(payment.reference)).rejects.toThrow(
      'not been completed',
    );
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    'amount',
    'currency',
    'merchantReference',
    'provider',
    'providerReference',
  ])('rejects OPay %s mismatch', async (field) => {
    const { service, payment, opayVerified, tx } = setup();
    payment.provider = PaymentProvider.OPAY;
    payment.providerReference = 'opay-order-1';
    Object.assign(opayVerified, { [field]: field === 'amount' ? 1 : 'WRONG' });
    await expect(service.verify(payment.reference)).rejects.toThrow(
      'does not match',
    );
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
  it('fulfills OPay through the shared operation and acknowledges duplicate callbacks', async () => {
    const { service, payment, tx, opayVerified } = setup();
    payment.provider = PaymentProvider.OPAY;
    await service.handleOpayWebhook(Buffer.from('{}'));
    await service.handleOpayWebhook(Buffer.from('{}'));
    expect(payment.status).toBe('SUCCESSFUL');
    expect(payment.providerReference).toBe(opayVerified.providerReference);
    expect(tx.accessCode.updateMany).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid callbacks before querying or reading payments', async () => {
    const { service, opay, prisma } = setup();
    opay.authenticateCallback.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    await expect(
      service.handleOpayWebhook(Buffer.from('{}')),
    ).rejects.toThrow();
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(opay.queryTransaction).not.toHaveBeenCalled();
  });
  it('acknowledges unknown and wrong-provider OPay callbacks without verification', async () => {
    const { service, prisma, opay } = setup();
    await service.handleOpayWebhook(Buffer.from('{}'));
    prisma.payment.findUnique.mockResolvedValueOnce(null as never);
    await service.handleOpayWebhook(Buffer.from('{}'));
    expect(opay.queryTransaction).not.toHaveBeenCalled();
  });
  describe('bounded reconciliation', () => {
    function recovery() {
      const fixture = setup();
      const findMany = vi
        .fn()
        .mockResolvedValue([
          { id: fixture.payment.id, reference: fixture.payment.reference },
        ]);
      Object.assign(fixture.prisma.payment, { findMany });
      return { ...fixture, findMany };
    }
    it('fulfills verified success using existing atomic fulfillment', async () => {
      const { service, payment, code, findMany } = recovery();
      const result = await service.reconcilePending(1, 'cursor');
      expect(result.outcomes[0].outcome).toBe('fulfilled');
      expect(payment.status).toBe(PaymentStatus.SUCCESSFUL);
      expect(code.status).toBe(AccessCodeStatus.SOLD);
      expect(findMany.mock.calls[0][0]).toMatchObject({
        take: 1,
        where: { id: { gt: 'cursor' }, status: 'PENDING' },
      });
      expect(result.nextAfterId).toBe(payment.id);
    });
    it('releases only authoritative failed attempts and detaches inventory', async () => {
      const { service, verified, payment, purchase, code } = recovery();
      verified.status = 'failed';
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'released',
      );
      expect(payment.status).toBe(PaymentStatus.FAILED);
      expect(purchase.accessCodeId).toBeNull();
      expect(code.status).toBe(AccessCodeStatus.AVAILABLE);
      expect(code.reservedAt).toBeNull();
    });
    it.each([
      'abandoned',
      'pending',
      'processing',
      'ongoing',
      'queued',
      'reversed',
      'unknown',
    ])('retains inventory for %s', async (status) => {
      const { service, verified, tx, code } = recovery();
      verified.status = status;
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'provider_status_unresolved',
      );
      expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
      expect(code.status).toBe(AccessCodeStatus.RESERVED);
    });
    it('retains inventory on mismatches and provider outages', async () => {
      const { service, verified, tx, paystack } = recovery();
      verified.amount = 1;
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'verification_or_fulfillment_error',
      );
      paystack.verifyTransaction.mockRejectedValue(
        new Error('secret provider detail'),
      );
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'verification_or_fulfillment_error',
      );
      expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
    });
    it('does not release when another unresolved attempt exists', async () => {
      const { service, verified, tx } = recovery();
      verified.status = 'failed';
      tx.payment.findFirst.mockResolvedValue({ id: 'other' } as never);
      expect((await service.reconcilePending(5)).outcomes[0].outcome).toBe(
        'verification_or_fulfillment_error',
      );
      expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
    });
    it('bounds batches and excludes concurrent local runs', async () => {
      const { service, findMany } = recovery();
      await expect(service.reconcilePending(6)).rejects.toThrow();
      let finish!: (value: []) => void;
      findMany.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const first = service.reconcilePending(1);
      await expect(service.reconcilePending(1)).rejects.toThrow(
        'already running',
      );
      finish([]);
      await first;
      findMany.mockResolvedValue([]);
      expect((await service.reconcilePending(1)).checked).toBe(0);
    });
  });
  it('prepares one atomic attempt and returns no reserved code', async () => {
    const { service, tx, paystack, codes } = setup();
    const result = await service.initialize('ANK-test');
    expect(result.paymentReference).toMatch(/^PAY-[A-F0-9]{32}$/);
    expect(result).not.toHaveProperty('accessCode');
    expect(codes.reserveAvailableCode).toHaveBeenCalledWith(
      'pkg',
      'purchase',
      tx,
    );
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(paystack.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10025,
        reference: result.paymentReference,
      }),
    );
    expect(tx.payment.create.mock.calls[0][0].data.amount.toString()).toBe(
      '100.25',
    );
  });
  it('blocks overlapping attempts before calling the provider', async () => {
    const { service, tx, paystack, codes } = setup();
    tx.payment.findFirst.mockResolvedValue({ reference: 'PAY-existing' });
    await expect(service.initialize('ANK-test')).rejects.toMatchObject({
      status: 409,
    });
    expect(paystack.initializeTransaction).not.toHaveBeenCalled();
    expect(codes.reserveAvailableCode).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it('validates callback configuration before database changes', async () => {
    const { service, config, prisma } = setup();
    config.set('FRONTEND_URL', 'javascript:alert(1)');
    await expect(service.initialize('ANK-test')).rejects.toMatchObject({
      status: 500,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('retains an uncertain initialization attempt and returns its reference for recovery', async () => {
    const { service, tx, paystack } = setup();
    paystack.initializeTransaction.mockRejectedValue(
      new Error('upstream secret'),
    );
    const error = await service
      .initialize('ANK-test')
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      status: 502,
      response: { paymentReference: expect.stringMatching(/^PAY-/) },
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
    expect(String(error)).not.toContain('upstream secret');
  });
  it.each(['amount', 'currency', 'reference', 'purchaseAmount'])(
    'rejects a mismatched %s without fulfillment',
    async (field) => {
      const { service, tx, verified, purchase } = setup();
      if (field === 'amount') verified.amount++;
      if (field === 'currency') verified.currency = 'USD';
      if (field === 'reference') verified.reference = 'PAY-other';
      if (field === 'purchaseAmount')
        purchase.amount = new Prisma.Decimal('200');
      await expect(service.verify('PAY-test')).rejects.toMatchObject({
        status: 502,
      });
      expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
      expect(tx.payment.update).not.toHaveBeenCalled();
    },
  );
  it('does not fulfill an unconfirmed payment', async () => {
    const { service, verified, tx } = setup();
    verified.status = 'pending';
    await expect(service.verify('PAY-test')).rejects.toMatchObject({
      status: 400,
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
  });
  it('fulfills once and repeated verification returns the same result', async () => {
    const { service, code, purchase, payment, tx, paystack } = setup();
    const first = await service.verify('PAY-test');
    const second = await service.verify('PAY-test');
    expect(first).toEqual(second);
    expect(code.status).toBe('SOLD');
    expect(purchase.status).toBe('COMPLETED');
    expect(payment.status).toBe('SUCCESSFUL');
    expect(code.reservedAt).toBeNull();
    expect(code.reservationExpiresAt).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.payment.update).toHaveBeenCalledOnce();
    expect(tx.purchase.update).toHaveBeenCalledOnce();
    expect(tx.accessCode.updateMany).toHaveBeenCalledOnce();
    expect(paystack.verifyTransaction).toHaveBeenCalledOnce();
  });
  it('checks the state again after taking the purchase lock', async () => {
    const { service, tx, payment, code, purchase } = setup();
    tx.$queryRaw.mockImplementation(async () => {
      payment.status = PaymentStatus.SUCCESSFUL;
      purchase.status = PurchaseStatus.COMPLETED;
      code.status = AccessCodeStatus.SOLD;
      payment.paidAt = purchase.completedAt = code.soldAt = new Date();
      return [];
    });
    expect(await service.verify('PAY-test')).toHaveProperty(
      'accessCode',
      '12345678',
    );
    expect(tx.payment.update).not.toHaveBeenCalled();
  });
  it('does not sell a code from a different package', async () => {
    const { service, code, tx } = setup();
    code.packageId = 'other';
    await expect(service.verify('PAY-test')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a competing attempt after another attempt completed the purchase', async () => {
    const { service, purchase, tx } = setup();
    purchase.status = PurchaseStatus.COMPLETED;
    await expect(service.verify('PAY-test')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
  });
  it('does not leak a code from an inconsistent successful record', async () => {
    const { service, payment, paystack } = setup();
    payment.status = PaymentStatus.SUCCESSFUL;
    await expect(service.verify('PAY-test')).rejects.toMatchObject({
      status: 409,
    });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });
  it('fails before other writes when a reservation changes', async () => {
    const { service, tx } = setup();
    tx.accessCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.verify('PAY-test')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.purchase.update).not.toHaveBeenCalled();
  });
});

describe('payment webhook processing', () => {
  const body = Buffer.from(
    JSON.stringify({
      event: 'charge.success',
      data: { reference: 'PAY-test', amount: 1 },
    }),
  );
  it('authenticates before parsing or database access', async () => {
    const { service, paystack, prisma } = setup();
    paystack.verifyWebhookSignature.mockReturnValue(false);
    await expect(service.handleWebhook(body, 'bad')).rejects.toMatchObject({
      status: 401,
    });
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });
  it.each([
    'null',
    '[]',
    '{}',
    '{',
    '{"event":"charge.success","data":[]}',
    '{"event":"charge.success","data":{"reference":""}}',
  ])('rejects invalid signed payload %s', async (raw) => {
    const { service, prisma } = setup();
    await expect(
      service.handleWebhook(Buffer.from(raw), 'signed'),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });
  it('acknowledges unsupported events without database access', async () => {
    const { service, prisma } = setup();
    expect(
      await service.handleWebhook(
        Buffer.from('{"event":"refund.processed"}'),
        'signed',
      ),
    ).toEqual({ received: true });
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });
  it('acknowledges unknown payment without creating anything', async () => {
    const { service, tx, paystack } = setup();
    tx.payment.findUnique.mockResolvedValue(null);
    expect(await service.handleWebhook(body, 'signed')).toEqual({
      received: true,
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
  });
  it('verifies authoritatively and duplicate deliveries fulfill only once', async () => {
    const { service, tx, paystack } = setup();
    expect(await service.handleWebhook(body, 'signed')).toEqual({
      received: true,
    });
    expect(await service.handleWebhook(body, 'signed')).toEqual({
      received: true,
    });
    expect(paystack.verifyTransaction).toHaveBeenCalledOnce();
    expect(tx.accessCode.updateMany).toHaveBeenCalledOnce();
    expect(tx.payment.update).toHaveBeenCalledOnce();
  });
  it.each(['amount', 'currency', 'reference', 'status'])(
    'does not fulfill a provider %s mismatch',
    async (field) => {
      const { service, verified, tx } = setup();
      if (field === 'amount') verified.amount++;
      if (field === 'currency') verified.currency = 'USD';
      if (field === 'reference') verified.reference = 'PAY-other';
      if (field === 'status') verified.status = 'pending';
      await expect(service.handleWebhook(body, 'signed')).rejects.toMatchObject(
        { status: 503, message: 'Webhook processing temporarily unavailable' },
      );
      expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
    },
  );
  it('retains pending state and reservation after Paystack timeout', async () => {
    const { service, paystack, tx, payment, code } = setup();
    paystack.verifyTransaction.mockRejectedValue(new Error('upstream secret'));
    await expect(service.handleWebhook(body, 'signed')).rejects.toMatchObject({
      status: 503,
    });
    expect(payment.status).toBe('PENDING');
    expect(code.status).toBe('RESERVED');
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });
});
