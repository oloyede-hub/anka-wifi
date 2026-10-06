import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { OpayService } from './opay.service';

const config = {
  OPAY_MERCHANT_ID: '123456789',
  OPAY_PUBLIC_KEY: 'test-public',
  OPAY_PRIVATE_KEY: 'test-private',
  OPAY_BASE_URL: 'https://testapi.opaycheckout.com',
};
const input = {
  reference: 'PAY-TEST',
  amount: 10025,
  email: 'test@example.com',
  phone: '08012345678',
  productName: 'Daily Wi-Fi',
  returnUrl: 'https://anka.example/payment/callback?reference=PAY-TEST',
  cancelUrl: 'https://anka.example/payment/callback?reference=PAY-TEST',
  callbackUrl: 'https://api.anka.example/payments/opay/webhook',
};
const transaction = {
  reference: input.reference,
  orderNo: '1234567890123456789',
  amount: { total: 10025, currency: 'NGN' },
  status: 'INITIAL',
  cashierUrl: 'https://sandboxcashier.opaycheckout.com/checkout',
};
function setup(data: unknown = transaction) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: '00000', data })));
  vi.stubGlobal('fetch', fetchMock);
  return { service: new OpayService(new ConfigService(config)), fetchMock };
}
afterEach(() => vi.unstubAllGlobals());

describe('OPay official Cashier adapter', () => {
  it('creates checkout using public authentication, integer minor units and documented mobile fields', async () => {
    const { service, fetchMock } = setup();
    expect(await service.initializeTransaction(input)).toEqual({
      authorizationUrl: transaction.cashierUrl,
      providerReference: transaction.orderNo,
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://testapi.opaycheckout.com/api/v1/international/cashier/create',
    );
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer test-public',
      MerchantId: '123456789',
    });
    expect(JSON.parse(request.body)).toMatchObject({
      country: 'NG',
      amount: { total: 10025, currency: 'NGN' },
      customerVisitSource: 'BROWSER',
      evokeOpay: true,
      userInfo: { userMobile: input.phone },
      product: { name: input.productName },
    });
    expect(request.redirect).toBe('error');
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });
  it('queries by merchant reference using SHA-512 of the sorted, transmitted JSON', async () => {
    const { service, fetchMock } = setup({
      ...transaction,
      status: 'SUCCESS',
      createTime: 1600000000000,
    });
    const result = await service.queryTransaction(input.reference);
    expect(result).toMatchObject({
      provider: 'OPAY',
      merchantReference: input.reference,
      providerReference: transaction.orderNo,
      status: 'success',
      paidAt: null,
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/cashier\/status$/);
    expect(request.body).toBe('{"country":"NG","reference":"PAY-TEST"}');
    expect(request.headers.Authorization).toBe(
      `Bearer ${createHmac('sha512', config.OPAY_PRIVATE_KEY).update(request.body).digest('hex')}`,
    );
  });
  it.each(['INITIAL', 'PENDING', 'CLOSE'])(
    'holds unresolved %s',
    async (status) => {
      const { service } = setup({ ...transaction, status });
      expect((await service.queryTransaction(input.reference)).status).toBe(
        'pending',
      );
    },
  );
  it('normalizes authoritative FAIL', async () => {
    const { service } = setup({ ...transaction, status: 'FAIL' });
    expect((await service.queryTransaction(input.reference)).status).toBe(
      'failed',
    );
  });
  it.each([
    {},
    { ...transaction, orderNo: 123 },
    { ...transaction, amount: { total: 1.1, currency: 'NGN' } },
    { ...transaction, status: 'UNKNOWN' },
    { ...transaction, isVoided: true },
  ])('rejects malformed provider data', async (data) => {
    const { service } = setup(data);
    await expect(service.queryTransaction(input.reference)).rejects.toThrow(
      'Invalid OPay',
    );
  });
  it.each([
    'http://sandboxcashier.opaycheckout.com',
    'https://opaycheckout.com.evil.example',
    'https://user:secret@sandboxcashier.opaycheckout.com',
  ])('rejects unsafe cashier URL %s', async (cashierUrl) => {
    const { service } = setup({ ...transaction, cashierUrl });
    await expect(service.initializeTransaction(input)).rejects.toThrow(
      'checkout URL',
    );
  });
  it.each([
    'https://evil.example',
    'http://testapi.opaycheckout.com',
    'https://testapi.opaycheckout.com/unsafe',
  ])('rejects unsafe API base %s before network', async (OPAY_BASE_URL) => {
    const { fetchMock } = setup();
    const service = new OpayService(
      new ConfigService({ ...config, OPAY_BASE_URL }),
    );
    await expect(service.queryTransaction(input.reference)).rejects.toThrow(
      'configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['timeout', 'malformed-json', 'rejected'])(
    'returns a safe error for %s',
    async (failure) => {
      const { service, fetchMock } = setup();
      if (failure === 'timeout')
        fetchMock.mockRejectedValue(new Error('private-key secret'));
      else
        fetchMock.mockResolvedValue(
          new Response(
            failure === 'malformed-json'
              ? '{'
              : '{"code":"02000","message":"secret"}',
          ),
        );
      await expect(service.queryTransaction(input.reference)).rejects.toThrow(
        'could not be confirmed',
      );
    },
  );
});

describe('OPay callback signatures', () => {
  // Official public sample vector from callback-signature, not merchant credentials.
  const payload = {
    amount: '49160',
    currency: 'NGN',
    reference: '10023',
    refunded: false,
    status: 'SUCCESS',
    timestamp: '2022-05-07T06:20:46Z',
    token: '220507145660712931829',
    transactionId: '220507145660712931829',
  };
  const sha512 =
    '9f605d69f04e94172875dc156537071cead060bbcaeaca94a7b8805af9f89611e2fdf6836713c9c90b028ca7e4470b1356e996975f2abc862315aaa9b7f2ae2d';
  const service = new OpayService(
    new ConfigService({
      ...config,
      OPAY_PRIVATE_KEY: 'OPAYPRV16498196872570.13953388019021462',
    }),
  );
  it('validates the official SHA3-512 sample vector independent of JSON whitespace/order', () => {
    const raw = Buffer.from(
      JSON.stringify(
        { type: 'transaction-status', sha512: sha512.toUpperCase(), payload },
        null,
        2,
      ),
    );
    expect(service.authenticateCallback(raw)).toEqual({
      type: 'transaction-status',
      payload,
    });
  });
  it('rejects a modified signed field and a wrong algorithm', () => {
    expect(() =>
      service.authenticateCallback(
        Buffer.from(
          JSON.stringify({
            type: 'transaction-status',
            sha512,
            payload: { ...payload, amount: '1' },
          }),
        ),
      ),
    ).toThrow('signature');
    expect(() =>
      service.authenticateCallback(
        Buffer.from(
          JSON.stringify({
            type: 'transaction-status',
            sha512: 'a'.repeat(128),
            payload,
          }),
        ),
      ),
    ).toThrow('signature');
  });
  it.each([undefined, Buffer.from('{'), Buffer.from('{}')])(
    'rejects malformed callback',
    (raw) => {
      expect(() => service.authenticateCallback(raw)).toThrow('payload');
    },
  );
});
