import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProvider } from '../../generated/prisma/client';
import { VerifiedTransaction } from '../verified-transaction';
import { OpayCallbackPayload, OpayCheckoutInput } from './opay.types';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class OpayService {
  constructor(private readonly config: ConfigService) {}

  // Lazy validation keeps existing Paystack installations usable without OPay credentials.
  configuration() {
    try {
      const merchantId = this.config.get<string>('OPAY_MERCHANT_ID');
      const publicKey = this.config.get<string>('OPAY_PUBLIC_KEY');
      const privateKey = this.config.get<string>('OPAY_PRIVATE_KEY');
      const url = new URL(
        this.config.get<string>('OPAY_BASE_URL') ??
          'https://testapi.opaycheckout.com',
      );
      if (
        !merchantId ||
        !/^\d{1,32}$/.test(merchantId) ||
        !publicKey?.trim() ||
        !privateKey?.trim() ||
        ![
          'https://testapi.opaycheckout.com',
          'https://liveapi.opaycheckout.com',
        ].includes(url.origin) ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error();
      return { merchantId, publicKey, privateKey, baseUrl: url.origin };
    } catch {
      throw new InternalServerErrorException(
        'OPay is not configured correctly',
      );
    }
  }

  private async request(
    path: string,
    payload: Record<string, unknown>,
    signed: boolean,
  ) {
    const config = this.configuration();
    // Status payload keys are alphabetical, as required by the API signature guide.
    const body = JSON.stringify(payload);
    const authorization = signed
      ? createHmac('sha512', config.privateKey).update(body).digest('hex')
      : config.publicKey;
    try {
      const response = await fetch(
        `${config.baseUrl}/api/v1/international/cashier/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authorization}`,
            MerchantId: config.merchantId,
            'Content-Type': 'application/json',
          },
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      );
      const result: unknown = await response.json();
      if (
        !response.ok ||
        !record(result) ||
        result.code !== '00000' ||
        !record(result.data)
      )
        throw new Error();
      return result.data;
    } catch {
      throw new BadGatewayException(
        'OPay request could not be confirmed; verify the payment before retrying',
      );
    }
  }

  private normalize(data: Record<string, unknown>): VerifiedTransaction {
    if (
      typeof data.reference !== 'string' ||
      !/^[A-Za-z0-9.=-]{1,128}$/.test(data.reference) ||
      typeof data.orderNo !== 'string' ||
      !/^[A-Za-z0-9-]{1,128}$/.test(data.orderNo) ||
      !record(data.amount) ||
      typeof data.amount.total !== 'number' ||
      !Number.isSafeInteger(data.amount.total) ||
      data.amount.total < 0 ||
      typeof data.amount.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(data.amount.currency) ||
      typeof data.status !== 'string' ||
      !['INITIAL', 'PENDING', 'SUCCESS', 'FAIL', 'CLOSE'].includes(
        data.status,
      ) ||
      (data.isVoided !== undefined && data.isVoided !== false)
    ) {
      throw new BadGatewayException('Invalid OPay transaction response');
    }
    return {
      provider: PaymentProvider.OPAY,
      merchantReference: data.reference,
      providerReference: data.orderNo,
      amount: data.amount.total,
      currency: data.amount.currency,
      status:
        data.status === 'SUCCESS'
          ? 'success'
          : data.status === 'FAIL'
            ? 'failed'
            : 'pending',
      // createTime describes order creation, not payment. Use verified local fulfillment time.
      paidAt: null,
    };
  }

  async initializeTransaction(input: OpayCheckoutInput) {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
      throw new BadRequestException('Invalid payment amount');
    const data = await this.request(
      'create',
      {
        country: 'NG',
        reference: input.reference,
        amount: { total: input.amount, currency: 'NGN' },
        returnUrl: input.returnUrl,
        callbackUrl: input.callbackUrl,
        cancelUrl: input.cancelUrl,
        displayName: 'Anka WiFi',
        customerVisitSource: 'BROWSER',
        evokeOpay: true,
        userInfo: { userEmail: input.email, userMobile: input.phone },
        product: {
          name: input.productName,
          description: `Wi-Fi access: ${input.productName}`,
        },
      },
      false,
    );
    const transaction = this.normalize(data);
    if (
      transaction.merchantReference !== input.reference ||
      transaction.amount !== input.amount ||
      transaction.currency !== 'NGN'
    )
      throw new BadGatewayException(
        'OPay checkout does not match the stored payment',
      );
    try {
      if (typeof data.cashierUrl !== 'string') throw new Error();
      const url = new URL(data.cashierUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !(
          url.hostname === 'opaycheckout.com' ||
          url.hostname.endsWith('.opaycheckout.com')
        )
      )
        throw new Error();
      return {
        authorizationUrl: url.href,
        providerReference: transaction.providerReference,
      };
    } catch {
      throw new BadGatewayException('Invalid OPay checkout URL');
    }
  }

  async queryTransaction(reference: string): Promise<VerifiedTransaction> {
    // Query by merchant reference also recovers initialization with a lost response/orderNo.
    return this.normalize(
      await this.request('status', { country: 'NG', reference }, true),
    );
  }

  authenticateCallback(rawBody: Buffer | undefined) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody?.toString('utf8') ?? '');
    } catch {
      throw new BadRequestException('Invalid OPay callback payload');
    }
    if (
      !record(body) ||
      !record(body.payload) ||
      typeof body.type !== 'string' ||
      body.type.length > 128
    )
      throw new BadRequestException('Invalid OPay callback payload');
    const p = body.payload;
    const safeString = (value: unknown, max = 128): value is string =>
      typeof value === 'string' &&
      value.length <= max &&
      [...value].every(
        (character) =>
          character.charCodeAt(0) >= 32 &&
          character.charCodeAt(0) !== 127 &&
          character !== '"' &&
          character !== '\\',
      );
    if (
      !safeString(p.amount) ||
      !/^\d{1,20}$/.test(p.amount) ||
      !safeString(p.currency) ||
      !/^[A-Z]{3}$/.test(p.currency) ||
      !safeString(p.reference) ||
      !/^[A-Za-z0-9.=-]{1,128}$/.test(p.reference) ||
      typeof p.refunded !== 'boolean' ||
      !safeString(p.status) ||
      !p.status ||
      !safeString(p.timestamp) ||
      !Number.isFinite(Date.parse(p.timestamp)) ||
      !(p.token == null || safeString(p.token)) ||
      !safeString(p.transactionId) ||
      !p.transactionId
    )
      throw new BadRequestException('Invalid OPay callback payload');
    const payload: OpayCallbackPayload = {
      amount: p.amount,
      currency: p.currency,
      reference: p.reference,
      refunded: p.refunded,
      status: p.status,
      timestamp: p.timestamp,
      token: p.token == null ? '' : p.token,
      transactionId: p.transactionId,
    };
    if (
      typeof body.sha512 !== 'string' ||
      !/^[a-fA-F0-9]{128}$/.test(body.sha512)
    )
      throw new UnauthorizedException('Invalid OPay callback signature');
    // Official callback signature uses this case-sensitive format, not raw JSON or SHA-512.
    const canonical = `{Amount:"${payload.amount}",Currency:"${payload.currency}",Reference:"${payload.reference}",Refunded:${payload.refunded ? 't' : 'f'},Status:"${payload.status}",Timestamp:"${payload.timestamp}",Token:"${payload.token}",TransactionID:"${payload.transactionId}"}`;
    const expected = createHmac('sha3-512', this.configuration().privateKey)
      .update(canonical)
      .digest();
    if (!timingSafeEqual(Buffer.from(body.sha512, 'hex'), expected))
      throw new UnauthorizedException('Invalid OPay callback signature');
    return { type: body.type, payload };
  }
}
