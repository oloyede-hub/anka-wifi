import { PaymentProvider } from '../generated/prisma/client';

export interface VerifiedTransaction {
  provider: PaymentProvider;
  merchantReference: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  paidAt: string | null;
}
