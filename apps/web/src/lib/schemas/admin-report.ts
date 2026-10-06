import { z } from "zod";
const count = z.number().int().nonnegative();
const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const series = z.array(z.object({ label: z.string(), amount: money }));
const periods = z.object({ daily: series, weekly: series, monthly: series });
const slices = z.array(z.object({ label: z.string(), count }));
function summary<T extends Record<string, typeof count>>(statuses: T) {
  return z.object({ total: count, statuses: z.object(statuses) });
}
export const dashboardAnalyticsSchema = z.object({
  asOf: z.string(),
  timeZone: z.literal("Africa/Lagos"),
  currency: z.literal("NGN"),
  sales: periods,
  paymentVolume: periods,
  paymentStatus: slices,
  packageSales: slices,
  totals: z.object({
    purchases: count,
    revenue: money,
    codesSold: count,
    availableCodes: count,
  }),
  summaries: z.object({
    purchases: summary({
      PENDING: count,
      COMPLETED: count,
      FAILED: count,
      CANCELLED: count,
    }),
    payments: summary({
      PENDING: count,
      SUCCESSFUL: count,
      FAILED: count,
      REFUNDED: count,
    }),
    accessCodes: summary({
      AVAILABLE: count,
      RESERVED: count,
      SOLD: count,
      DISABLED: count,
    }),
    packages: summary({ ACTIVE: count, INACTIVE: count }).extend({
      averagePrice: money,
    }),
  }),
});
export type DashboardAnalytics = z.infer<typeof dashboardAnalyticsSchema>;
