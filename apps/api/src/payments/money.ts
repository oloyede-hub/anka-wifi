import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export function toKobo(amount: Prisma.Decimal): number {
  const kobo = amount.mul(100);
  if (!kobo.isInteger() || kobo.lte(0) || kobo.gt(Number.MAX_SAFE_INTEGER)) {
    throw new InternalServerErrorException('Stored payment amount is invalid');
  }
  return kobo.toNumber();
}
