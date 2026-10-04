import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { PaystackVerifyResponse } from './paystack/paystack.types';
import { toKobo } from './money';

const paymentInclude = {
  purchase: { include: { accessCode: true, package: true } },
} satisfies Prisma.PaymentInclude;
type PaymentWithPurchase = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCodesService: AccessCodesService,
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
  ) {}

  async initialize(purchaseReference: string) {
    const callbackUrl = this.callbackUrl(); // Validate local configuration before reserving inventory.
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
          provider: PaymentProvider.PAYSTACK,
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
      };
    });
    // No database lock is held during network I/O. Never reuse this reference for initialization.
    try {
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
        authorizationUrl: response.data.authorization_url,
      };
    } catch {
      // A timeout may occur after Paystack accepted the request. Keep the attempt/reservation for reconciliation.
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
      payment.provider !== PaymentProvider.PAYSTACK ||
      payment.status === PaymentStatus.REFUNDED
    )
      throw new ConflictException('Payment cannot be verified');
    if (payment.status === PaymentStatus.SUCCESSFUL)
      return this.result(payment);
    const verified = await this.paystackService.verifyTransaction(
      payment.reference,
    );
    this.validateTransaction(payment, verified.data);
    if (verified.data.status !== 'success') {
      // Failure/recovery and reservation release will be added with webhook handling.
      throw new BadRequestException('Payment has not been completed');
    }
    return this.fulfillVerifiedPayment(payment.id, verified.data);
  }

  // Shared business operation for future webhooks. Call only after authoritative provider verification.
  private async fulfillVerifiedPayment(
    paymentId: string,
    verified: PaystackVerifyResponse['data'],
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
          providerReference: verified.reference,
          paidAt: verified.paid_at ? new Date(verified.paid_at) : now,
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
    verified: PaystackVerifyResponse['data'],
  ) {
    if (
      payment.provider !== PaymentProvider.PAYSTACK ||
      verified.reference !== payment.reference ||
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
      payment: { reference: payment.reference, status: payment.status },
      purchase: {
        reference: payment.purchase.reference,
        status: payment.purchase.status,
        package: payment.purchase.package.name,
      },
      accessCode: code.code,
    };
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
}
