import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const periods = {
  daily: { unit: 'day', step: '1 day', count: 30, label: 'DD Mon' },
  weekly: { unit: 'week', step: '1 week', count: 12, label: 'DD Mon' },
  monthly: { unit: 'month', step: '1 month', count: 12, label: 'Mon YYYY' },
} as const;
type SeriesPoint = { label: string; amount: string };
type StatusGroup = { status: string; _count: { _all: number } };
function summarize(statuses: readonly string[], rows: StatusGroup[]) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const row of rows) counts[row.status] = row._count._all;
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    statuses: counts,
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(asOf = new Date()) {
    // Every card/series in one response sees the same committed database snapshot.
    return this.prisma.$transaction(
      async (tx) => {
        const [
          purchaseGroups,
          paymentGroups,
          codeGroups,
          packageGroups,
          revenue,
          prices,
          packageSales,
        ] = await Promise.all([
          tx.purchase.groupBy({ by: ['status'], _count: { _all: true } }),
          tx.payment.groupBy({ by: ['status'], _count: { _all: true } }),
          tx.accessCode.groupBy({ by: ['status'], _count: { _all: true } }),
          tx.wifiPackage.groupBy({ by: ['status'], _count: { _all: true } }),
          tx.purchase.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { amount: true },
          }),
          tx.wifiPackage.aggregate({ _avg: { price: true } }),
          tx.$queryRaw<{ label: string; count: bigint }[]>(Prisma.sql`
          SELECT w."name" AS label, COUNT(*) AS count
          FROM "Purchase" p JOIN "WifiPackage" w ON w."id" = p."packageId"
          WHERE p."status" = 'COMPLETED'
          GROUP BY w."name" ORDER BY count DESC, w."name" ASC
        `),
        ]);
        const purchases = summarize(
          ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
          purchaseGroups,
        );
        const payments = summarize(
          ['PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED'],
          paymentGroups,
        );
        const accessCodes = summarize(
          ['AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED'],
          codeGroups,
        );
        const packages = {
          ...summarize(['ACTIVE', 'INACTIVE'], packageGroups),
          averagePrice: prices._avg.price?.toFixed(2) ?? '0.00',
        };
        const sales = {
          daily: [] as SeriesPoint[],
          weekly: [] as SeriesPoint[],
          monthly: [] as SeriesPoint[],
        };
        const paymentVolume = {
          daily: [] as SeriesPoint[],
          weekly: [] as SeriesPoint[],
          monthly: [] as SeriesPoint[],
        };
        for (const period of ['daily', 'weekly', 'monthly'] as const) {
          sales[period] = await this.series(tx, 'sales', period, asOf);
          paymentVolume[period] = await this.series(
            tx,
            'paymentVolume',
            period,
            asOf,
          );
        }
        return {
          asOf: asOf.toISOString(),
          timeZone: 'Africa/Lagos',
          currency: 'NGN',
          totals: {
            purchases: purchases.total,
            revenue: revenue._sum.amount?.toFixed(2) ?? '0.00',
            codesSold: accessCodes.statuses.SOLD,
            availableCodes: accessCodes.statuses.AVAILABLE,
          },
          summaries: { purchases, payments, accessCodes, packages },
          sales,
          paymentVolume,
          paymentStatus: Object.entries(payments.statuses).map(
            ([status, count]) => ({
              label: status.charAt(0) + status.slice(1).toLowerCase(),
              count,
            }),
          ),
          packageSales: packageSales.map((row) => ({
            label: row.label,
            count: Number(row.count),
          })),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10000,
      },
    );
  }

  private series(
    tx: Prisma.TransactionClient,
    kind: 'sales' | 'paymentVolume',
    period: keyof typeof periods,
    asOf: Date,
  ) {
    const settings = periods[period];
    // SQL fragments are fixed internal identifiers, never request input.
    const table =
      kind === 'sales' ? Prisma.sql`"Purchase"` : Prisma.sql`"Payment"`;
    const timestamp =
      kind === 'sales' ? Prisma.sql`"completedAt"` : Prisma.sql`"paidAt"`;
    const condition =
      kind === 'sales'
        ? Prisma.sql`r."status" = 'COMPLETED'`
        : Prisma.sql`r."status" = 'SUCCESSFUL' AND r."currency" = 'NGN'`;
    return tx.$queryRaw<SeriesPoint[]>(Prisma.sql`
      WITH settings AS (
        SELECT date_trunc(${settings.unit}::text, ${asOf}::timestamptz AT TIME ZONE 'Africa/Lagos') AS anchor
      ), buckets AS (
        SELECT generate_series(anchor - (${settings.count}::int - 1) * ${settings.step}::interval, anchor, ${settings.step}::interval) AS bucket FROM settings
      ), amounts AS (
        SELECT date_trunc(${settings.unit}::text, r.${timestamp} AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos') AS bucket, SUM(r."amount") AS amount
        FROM ${table} r
        WHERE ${condition}
          AND r.${timestamp} >= ((SELECT MIN(bucket) FROM buckets) AT TIME ZONE 'Africa/Lagos' AT TIME ZONE 'UTC')
          AND r.${timestamp} <= (${asOf}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      )
      SELECT to_char(b.bucket, ${settings.label}::text) AS label, COALESCE(a.amount, 0)::text AS amount
      FROM buckets b LEFT JOIN amounts a ON a.bucket = b.bucket ORDER BY b.bucket
    `);
  }
}
