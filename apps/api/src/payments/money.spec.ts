import { toKobo } from './money';
import { Prisma } from '../generated/prisma/client';
describe('money conversion', () => {
  it.each([
    ['2500.00', 250000],
    ['0.29', 29],
    ['99999999.99', 9999999999],
  ])('converts %s to exact integer kobo', (amount, expected) => {
    expect(toKobo(new Prisma.Decimal(amount))).toBe(expected);
  });
  it.each(['0', '-1', '1.001', '90071992547409.92', 'NaN', 'Infinity'])(
    'rejects invalid stored amount %s',
    (amount) => {
      expect(() => toKobo(new Prisma.Decimal(amount))).toThrow();
    },
  );
});
