import { ListPaymentsDto } from './dto/list-payments.dto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { isEmail } from 'class-validator';
import {
  AccessCodeStatus,
  PackageStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PurchaseStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessCodesService } from '../access-codes/access-codes.service';
import { PaystackService } from './paystack/paystack.service';
import { OpayService } from './opay/opay.service';
import { VerifiedTransaction } from './verified-transaction';
import { toKobo } from './money';

const paymentInclude = {
  purchase: { include: { accessCode: true, package: true } },
} satisfies Prisma.PaymentInclude;
type PaymentWithPurchase = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private reconciliationRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCodesService: AccessCodesService,
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
    private readonly opayService: OpayService,
  ) {}

  async initialize(
    purchaseReference: string,
    provider: PaymentProvider = PaymentProvider.PAYSTACK,
  ) {
    if (
      provider !== PaymentProvider.PAYSTACK &&
      provider !== PaymentProvider.OPAY
    )
      throw new BadRequestException('Unsupported checkout provider');
    const callbackUrl = this.callbackUrl();
    const opayCallbackUrl =
      provider === PaymentProvider.OPAY ? this.opayCallbackUrl() : undefined;
    if (provider === PaymentProvider.OPAY) this.opayService.configuration();

    const prepared = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Purchase" WHERE "reference" = ${purchaseReference} FOR UPDATE`,
      );
      const purchase = await tx.purchase.findUnique({
        where: { reference: purchaseReference },
        include: { customer: true, package: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status !== PurchaseStatus.PENDING)
        throw new ConflictException('This purchase cannot be paid for');
      if (purchase.package.status !== PackageStatus.ACTIVE)
        throw new BadRequestException('Package is not available');
      if (!purchase.customer.email || !isEmail(purchase.customer.email))
        throw new BadRequestException(
          'Valid customer email is required for payment',
        );
      const amount = toKobo(purchase.amount);
      if (
        provider === PaymentProvider.OPAY &&
        !/^\+?\d{7,15}$/.test(purchase.customer.phone)
      )
        throw new BadRequestException(
          'Valid customer phone is required for OPay',
        );
      const pending = await tx.payment.findFirst({
        where: {
          purchaseId: purchase.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESSFUL] },
        },
      });
      if (pending)
        throw new ConflictException({
          message:
            'An unresolved payment already exists; verify it before starting another attempt',
          paymentReference: pending.reference,
        });
      await this.accessCodesService.reserveAvailableCode(
        purchase.packageId,
        purchase.id,
        tx,
      );
      const payment = await tx.payment.create({
        data: {
          reference: `PAY-${randomBytes(16).toString('hex').toUpperCase()}`,
          provider,
          status: PaymentStatus.PENDING,
          amount: purchase.amount,
          currency: 'NGN',
          purchaseId: purchase.id,
        },
      });
      return {
        purchaseReference: purchase.reference,
        paymentReference: payment.reference,
        amount,
        email: purchase.customer.email,
        phone: purchase.customer.phone,
        productName: purchase.package.name,
      };
    });
    // No database lock is held during network I/O. Never reuse this reference for initialization.
    try {
      if (provider === PaymentProvider.OPAY) {
        const returnUrl = new URL(callbackUrl);
        returnUrl.searchParams.set('reference', prepared.paymentReference);
        const response = await this.opayService.initializeTransaction({
          reference: prepared.paymentReference,
          amount: prepared.amount,
          email: prepared.email,
          phone: prepared.phone,
          productName: prepared.productName,
          returnUrl: returnUrl.href,
          cancelUrl: returnUrl.href,
          callbackUrl: opayCallbackUrl!,
        });
        // A callback can race this response. Never overwrite a different or completed order.
        await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Purchase" WHERE "reference" = ${prepared.purchaseReference} FOR UPDATE`,
          );
          const current = await tx.payment.findUniqueOrThrow({
            where: { reference: prepared.paymentReference },
          });
          if (
            current.provider !== PaymentProvider.OPAY ||
            (current.providerReference &&
              current.providerReference !== response.providerReference)
          )
            throw new ConflictException(
              'Provider order requires reconciliation',
            );
          if (!current.providerReference)
            await tx.payment.update({
              where: { id: current.id },
              data: { providerReference: response.providerReference },
            });
        });
        return {
          purchaseReference: prepared.purchaseReference,
          paymentReference: prepared.paymentReference,
          provider,
          authorizationUrl: response.authorizationUrl,
        };
      }
      const response = await this.paystackService.initializeTransaction({
        email: prepared.email,
        amount: prepared.amount,
        reference: prepared.paymentReference,
        callbackUrl,
        metadata: { purchaseReference: prepared.purchaseReference },
      });
      return {
        purchaseReference: prepared.purchaseReference,
        paymentReference: prepared.paymentReference,
        provider,
        authorizationUrl: response.data.authorization_url,
      };
    } catch {
      // A timeout may occur after the provider accepted the request. Keep the attempt/reservation for reconciliation.
      throw new BadGatewayException({
        message:
          'Unable to initialize payment; verify this attempt before retrying',
        purchaseReference: prepared.purchaseReference,
        paymentReference: prepared.paymentReference,
      });
    }
  }

  async verify(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (
      (payment.provider !== PaymentProvider.PAYSTACK &&
        payment.provider !== PaymentProvider.OPAY) ||
      payment.status === PaymentStatus.REFUNDED
    )
      throw new ConflictException('Payment cannot be verified');
    if (payment.status === PaymentStatus.SUCCESSFUL)
      return this.result(payment);
    const verified = await this.queryTransaction(payment);
    this.validateTransaction(payment, verified);
    if (verified.status !== 'success') {
      // Uncertain statuses never release inventory through public verification.
      throw new BadRequestException({
        message: 'Payment has not been completed',
        paymentState: verified.status === 'failed' ? 'FAILED' : 'PENDING',
      });
    }
    return this.fulfillVerifiedPayment(payment.id, verified);
  }

  private async queryTransaction(
    payment: PaymentWithPurchase,
  ): Promise<VerifiedTransaction> {
    if (payment.provider === PaymentProvider.OPAY)
      return this.opayService.queryTransaction(payment.reference);
    if (payment.provider !== PaymentProvider.PAYSTACK)
      throw new ConflictException('Payment cannot be verified');
    const { data } = await this.paystackService.verifyTransaction(
      payment.reference,
    );
    return {
      provider: PaymentProvider.PAYSTACK,
      merchantReference: data.reference,
      providerReference: String(data.id),
      amount: data.amount,
      currency: data.currency,
      status:
        data.status === 'success'
          ? 'success'
          : data.status === 'failed'
            ? 'failed'
            : 'pending',
      paidAt: data.paid_at,
    };
  }

  async handleOpayWebhook(rawBody: Buffer | undefined) {
    const callback = this.opayService.authenticateCallback(rawBody);
    if (
      callback.type !== 'transaction-status' ||
      callback.payload.status !== 'SUCCESS' ||
      callback.payload.refunded
    )
      return { received: true };
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { reference: callback.payload.reference },
        select: { provider: true, status: true },
      });
      if (!payment || payment.provider !== PaymentProvider.OPAY)
        return { received: true };
      if (payment.status === PaymentStatus.FAILED) {
        this.logger.error(
          JSON.stringify({
            event: 'payment_late_success_requires_review',
            provider: 'OPAY',
          }),
        );
        throw new ConflictException(
          'Failed payment received a success notification',
        );
      }
      if (payment.status === PaymentStatus.REFUNDED) return { received: true };
      await this.verify(callback.payload.reference);
      return { received: true };
    } catch {
      throw new ServiceUnavailableException(
        'OPay callback processing temporarily unavailable',
      );
    }
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ) {
    if (
      !rawBody ||
      !this.paystackService.verifyWebhookSignature(rawBody, signature)
    )
      throw new UnauthorizedException('Invalid webhook signature');
    // Process only the authenticated bytes, never a potentially altered parsed request.body.
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('event' in body) ||
      typeof body.event !== 'string' ||
      !body.event ||
      body.event.length > 128
    )
      throw new BadRequestException('Invalid webhook payload');
    if (body.event !== 'charge.success') return { received: true };
    if (
      !('data' in body) ||
      typeof body.data !== 'object' ||
      body.data === null ||
      Array.isArray(body.data) ||
      !('reference' in body.data) ||
      typeof body.data.reference !== 'string' ||
      !/^[A-Za-z0-9.=-]{1,128}$/.test(body.data.reference)
    )
      throw new BadRequestException('Invalid webhook payload');
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { reference: body.data.reference },
        select: { provider: true, status: true },
      });
      if (
        payment?.provider === PaymentProvider.PAYSTACK &&
        payment.status === PaymentStatus.FAILED
      ) {
        this.logger.error(
          JSON.stringify({ event: 'payment_late_success_requires_review' }),
        );
        throw new ConflictException(
          'Failed payment received a success notification',
        );
      }
      if (
        !payment ||
        payment.provider !== PaymentProvider.PAYSTACK ||
        !(
          [PaymentStatus.PENDING, PaymentStatus.SUCCESSFUL] as PaymentStatus[]
        ).includes(payment.status)
      )
        return { received: true };
      // Manual verification and webhooks share validation and the same locked fulfillment.
      await this.verify(body.data.reference);
      return { received: true };
    } catch {
      // Non-200 permits provider retry, without leaking references, code, contacts or database details.
      throw new ServiceUnavailableException(
        'Webhook processing temporarily unavailable',
      );
    }
  }
  // Shared business operation for webhooks and manual verification. Call only after authoritative provider verification.
  private async fulfillVerifiedPayment(
    paymentId: string,
    verified: VerifiedTransaction,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { purchaseId: true },
      });
      if (!found) throw new NotFoundException('Payment not found');
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${found.purchaseId} FOR UPDATE`,
      );
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: paymentInclude,
      });
      if (!payment) throw new NotFoundException('Payment not found');
      this.validateTransaction(payment, verified);
      if (verified.status !== 'success')
        throw new ConflictException('Payment is not successful');
      if (payment.status === PaymentStatus.SUCCESSFUL)
        return this.result(payment);
      if (
        payment.purchase.status !== PurchaseStatus.PENDING ||
        payment.status !== PaymentStatus.PENDING
      )
        throw new ConflictException(
          'Purchase or payment requires reconciliation',
        );
      const code = payment.purchase.accessCode;
      if (
        !code ||
        code.packageId !== payment.purchase.packageId ||
        code.status !== AccessCodeStatus.RESERVED ||
        !code.reservedAt ||
        !code.reservationExpiresAt
      )
        throw new ConflictException(
          'No valid access code reservation exists for this purchase',
        );
      const now = new Date();
      // An expired reservation still held for this unresolved attempt may fulfill a late success.
      const claimed = await tx.accessCode.updateMany({
        where: {
          id: code.id,
          packageId: payment.purchase.packageId,
          status: AccessCodeStatus.RESERVED,
          purchase: { is: { id: payment.purchaseId } },
        },
        data: {
          status: AccessCodeStatus.SOLD,
          soldAt: now,
          reservedAt: null,
          reservationExpiresAt: null,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException(
          'Access code reservation changed; payment requires reconciliation',
        );
      await tx.payment.update({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.SUCCESSFUL,
          providerReference: verified.providerReference,
          paidAt: verified.paidAt ? new Date(verified.paidAt) : now,
        },
      });
      await tx.purchase.update({
        where: {
          id: payment.purchaseId,
          status: PurchaseStatus.PENDING,
          accessCodeId: code.id,
        },
        data: { status: PurchaseStatus.COMPLETED, completedAt: now },
      });
      const completed = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: paymentInclude,
      });
      return this.result(completed);
    });
  }

  private validateTransaction(
    payment: PaymentWithPurchase,
    verified: VerifiedTransaction,
  ) {
    if (
      payment.provider !== verified.provider ||
      verified.merchantReference !== payment.reference ||
      !verified.providerReference ||
      (payment.provider === PaymentProvider.OPAY &&
        payment.providerReference != null &&
        payment.providerReference !== verified.providerReference) ||
      (payment.provider === PaymentProvider.PAYSTACK &&
        payment.providerReference != null &&
        payment.providerReference !== payment.reference &&
        payment.providerReference !== verified.providerReference) ||
      verified.amount !== toKobo(payment.amount) ||
      !payment.amount.equals(payment.purchase.amount) ||
      payment.currency !== 'NGN' ||
      verified.currency !== payment.currency
    ) {
      throw new BadGatewayException(
        'Payment provider transaction does not match the stored purchase',
      );
    }
  }

  private result(payment: PaymentWithPurchase) {
    const code = payment.purchase.accessCode;
    if (
      payment.status !== PaymentStatus.SUCCESSFUL ||
      payment.purchase.status !== PurchaseStatus.COMPLETED ||
      !code ||
      code.status !== AccessCodeStatus.SOLD ||
      code.packageId !== payment.purchase.packageId ||
      !payment.paidAt ||
      !payment.purchase.completedAt ||
      !code.soldAt
    )
      throw new ConflictException(
        'Payment fulfillment requires reconciliation',
      );
    return {
      message: 'Payment verified successfully',
      payment: {
        reference: payment.reference,
        status: payment.status,
        provider: payment.provider,
      },
      purchase: {
        reference: payment.purchase.reference,
        status: payment.purchase.status,
        package: payment.purchase.package.name,
      },
      accessCode: code.code,
    };
  }

  async reconcilePending(limit: number, afterId?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 5)
      throw new BadRequestException(
        'Reconciliation limit must be between 1 and 5',
      );
    if (this.reconciliationRunning)
      throw new ConflictException('Reconciliation is already running');
    this.reconciliationRunning = true;
    try {
      const candidates = await this.prisma.payment.findMany({
        where: {
          provider: { in: [PaymentProvider.PAYSTACK, PaymentProvider.OPAY] },
          status: PaymentStatus.PENDING,
          createdAt: { lte: new Date(Date.now() - 15 * 60 * 1000) },
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: limit,
        select: { id: true, reference: true },
      });
      const outcomes: { paymentId: string; outcome: string }[] = [];
      for (const candidate of candidates) {
        let outcome: string;
        try {
          outcome = await this.reconcileOne(candidate.reference);
        } catch {
          // Never log provider responses, exceptions, bearer references or customer data.
          outcome = 'verification_or_fulfillment_error';
        }
        outcomes.push({ paymentId: candidate.id, outcome });
        if (!['fulfilled', 'released', 'already_resolved'].includes(outcome))
          this.logger.warn(
            JSON.stringify({
              event: 'payment_reconciliation_attention',
              paymentId: candidate.id,
              reason: outcome,
            }),
          );
      }
      this.logger.log(
        JSON.stringify({
          event: 'payment_reconciliation_batch',
          checked: outcomes.length,
        }),
      );
      return {
        checked: outcomes.length,
        nextAfterId:
          candidates.length === limit
            ? candidates[candidates.length - 1].id
            : null,
        outcomes,
      };
    } finally {
      this.reconciliationRunning = false;
    }
  }

  private async reconcileOne(reference: string): Promise<string> {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: paymentInclude,
    });
    if (!payment || payment.status !== PaymentStatus.PENDING)
      return 'already_resolved';
    const verified = await this.queryTransaction(payment);
    this.validateTransaction(payment, verified);
    if (verified.status === 'success') {
      await this.fulfillVerifiedPayment(payment.id, verified);
      return 'fulfilled';
    }
    if (verified.status !== 'failed') return 'provider_status_unresolved';
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${payment.purchaseId} FOR UPDATE`,
      );
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        include: paymentInclude,
      });
      if (!current || current.status !== PaymentStatus.PENDING)
        return 'already_resolved';
      this.validateTransaction(current, verified);
      if (current.purchase.status !== PurchaseStatus.PENDING)
        throw new ConflictException('Purchase requires reconciliation');
      const other = await tx.payment.findFirst({
        where: {
          purchaseId: current.purchaseId,
          id: { not: current.id },
          status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESSFUL] },
        },
      });
      if (other) throw new ConflictException('Other unresolved payment exists');
      const code = current.purchase.accessCode;
      if (
        !code ||
        code.status !== AccessCodeStatus.RESERVED ||
        code.soldAt ||
        code.packageId !== current.purchase.packageId
      )
        throw new ConflictException('Reservation requires reconciliation');
      const released = await tx.accessCode.updateMany({
        where: {
          id: code.id,
          status: AccessCodeStatus.RESERVED,
          soldAt: null,
          purchase: { is: { id: current.purchaseId } },
        },
        data: {
          status: AccessCodeStatus.AVAILABLE,
          reservedAt: null,
          reservationExpiresAt: null,
        },
      });
      if (released.count !== 1)
        throw new ConflictException('Reservation changed');
      await tx.purchase.update({
        where: {
          id: current.purchaseId,
          status: PurchaseStatus.PENDING,
          accessCodeId: code.id,
        },
        data: { accessCodeId: null },
      });
      await tx.payment.update({
        where: { id: current.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.FAILED,
          providerReference: verified.providerReference,
        },
      });
      return 'released';
    });
  }

  findAllAdmin(query: ListPaymentsDto) {
    return this.prisma.payment.findMany({
      where: {
        status: query.status,
        ...(query.purchaseReference
          ? { purchase: { reference: query.purchaseReference } }
          : {}),
      },
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: adminPaymentSelect,
    });
  }
  async findOneAdmin(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      select: adminPaymentSelect,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
  private callbackUrl() {
    try {
      const configured = this.configService.get<string>('FRONTEND_URL');
      if (!configured) throw new Error();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (url.protocol === 'http:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      )
        throw new Error();
      return new URL('/payment/callback', url).toString();
    } catch {
      throw new InternalServerErrorException(
        'Payment callback URL is not configured correctly',
      );
    }
  }

  private opayCallbackUrl() {
    // Root API_URL is the public callback origin; the web proxy may use a separate local API_URL.
    try {
      const configured = this.configService.get<string>('API_URL');
      if (!configured) throw new Error();
      const url = new URL(configured);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      return new URL('/payments/opay/webhook', url).href;
    } catch {
      throw new InternalServerErrorException(
        'OPay requires a public HTTPS API_URL',
      );
    }
  }
}

const adminPaymentSelect = {
  reference: true,
  status: true,
  provider: true,
  providerReference: true,
  amount: true,
  currency: true,
  paidAt: true,
  createdAt: true,
  purchase: { select: { reference: true, status: true, packageId: true } },
} satisfies Prisma.PaymentSelect;
