import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InitializePaystackTransaction,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
} from './paystack.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class PaystackService {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    const secretKey = config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey)
      throw new InternalServerErrorException(
        'Payment provider is not configured',
      );
    this.secretKey = secretKey;
    const baseUrl =
      config.get<string>('PAYSTACK_BASE_URL') ?? 'https://api.paystack.co';
    try {
      const url = new URL(baseUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      this.baseUrl = baseUrl.replace(/\/$/, '');
    } catch {
      throw new InternalServerErrorException('Payment provider URL is invalid');
    }
  }

  private async request(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        !isRecord(result) ||
        result.status !== true ||
        !isRecord(result.data)
      )
        throw new Error();
      return result;
    } catch {
      throw new BadGatewayException(
        'Payment provider request failed; verify the payment before retrying',
      );
    }
  }

  async initializeTransaction(
    payload: InitializePaystackTransaction,
  ): Promise<PaystackInitializeResponse> {
    const result = await this.request('/transaction/initialize', {
      email: payload.email,
      amount: payload.amount.toString(),
      currency: 'NGN',
      reference: payload.reference,
      callback_url: payload.callbackUrl,
      metadata: payload.metadata,
    });
    const data = result.data;
    if (
      !isRecord(data) ||
      typeof data.authorization_url !== 'string' ||
      typeof data.access_code !== 'string' ||
      !data.access_code ||
      data.reference !== payload.reference
    ) {
      throw new BadGatewayException(
        'Invalid payment provider initialization response',
      );
    }
    try {
      const url = new URL(data.authorization_url);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error();
    } catch {
      throw new BadGatewayException(
        'Invalid payment provider authorization URL',
      );
    }
    return {
      status: true,
      message: 'Payment initialized',
      data: {
        authorization_url: data.authorization_url,
        access_code: data.access_code,
        reference: payload.reference,
      },
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const result = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    const data = result.data;
    if (
      !isRecord(data) ||
      !Number.isSafeInteger(data.id) ||
      typeof data.id !== 'number' ||
      data.id <= 0 ||
      typeof data.status !== 'string' ||
      typeof data.reference !== 'string' ||
      typeof data.amount !== 'number' ||
      !Number.isSafeInteger(data.amount) ||
      data.amount < 0 ||
      typeof data.currency !== 'string' ||
      !(
        data.paid_at === null ||
        (typeof data.paid_at === 'string' &&
          Number.isFinite(Date.parse(data.paid_at)))
      )
    ) {
      throw new BadGatewayException(
        'Invalid payment provider verification response',
      );
    }
    return {
      status: true,
      message: 'Payment checked',
      data: {
        id: data.id,
        status: data.status,
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        paid_at: data.paid_at,
        channel: typeof data.channel === 'string' ? data.channel : '',
      },
    };
  }
}
