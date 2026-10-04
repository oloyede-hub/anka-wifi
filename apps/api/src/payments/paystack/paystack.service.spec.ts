import { ConfigService } from '@nestjs/config';
import { PaystackService } from './paystack.service';

const reference = 'PAY-test';
const good = {
  status: true,
  data: {
    id: 1,
    status: 'success',
    reference,
    amount: 10000,
    currency: 'NGN',
    paid_at: '2026-10-04T09:00:00Z',
    channel: 'card',
  },
};
function config() {
  return new ConfigService({ PAYSTACK_SECRET_KEY: 'test-secret' });
}
function respond(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('PaystackService', () => {
  it('verifies a validated provider response and encodes the reference', async () => {
    const fetchMock = respond(good);
    const result = await new PaystackService(config()).verifyTransaction(
      reference,
    );
    expect(result.data.amount).toBe(10000);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.paystack.co/transaction/verify/${reference}`,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        redirect: 'error',
      }),
    );
  });
  it('initializes explicit NGN with integer kobo and server reference', async () => {
    const fetchMock = respond({
      status: true,
      data: {
        reference,
        access_code: 'checkout',
        authorization_url: 'https://checkout.paystack.com/checkout',
      },
    });
    await new PaystackService(config()).initializeTransaction({
      email: 'customer@example.com',
      amount: 250000,
      reference,
      callbackUrl: 'https://example.com/payment/callback',
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      amount: '250000',
      currency: 'NGN',
      reference,
    });
  });
  it.each([
    { status: true, data: {} },
    { status: true, data: { ...good.data, amount: '10000' } },
    { status: true, data: { ...good.data, paid_at: 'invalid' } },
    { status: false, message: 'secret upstream details' },
  ])(
    'rejects malformed or unsuccessful response without leaking upstream data',
    async (body) => {
      respond(body);
      await expect(
        new PaystackService(config()).verifyTransaction(reference),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
  it.each(['network', 'json', 'http'])(
    'handles %s failures as sanitized gateway errors',
    async (mode) => {
      if (mode === 'network')
        vi.stubGlobal(
          'fetch',
          vi.fn().mockRejectedValue(new Error('test-secret')),
        );
      if (mode === 'json')
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(new Response('<html>test-secret</html>')),
        );
      if (mode === 'http')
        respond({ status: false, message: 'test-secret' }, 500);
      const error = await new PaystackService(config())
        .verifyTransaction(reference)
        .catch((failure: unknown) => failure);
      expect(error).toMatchObject({ status: 502 });
      expect(String(error)).not.toContain('test-secret');
    },
  );
  it('rejects initialization reference mismatch', async () => {
    respond({
      status: true,
      data: {
        reference: 'other',
        access_code: 'checkout',
        authorization_url: 'https://checkout.paystack.com/checkout',
      },
    });
    await expect(
      new PaystackService(config()).initializeTransaction({
        email: 'customer@example.com',
        amount: 10000,
        reference,
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
