"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const series = z.array(z.object({ label: z.string(), amount: money }));
const periods = z.object({ daily: series, weekly: series, monthly: series });
const slices = z.array(
  z.object({ label: z.string(), count: z.number().int().nonnegative() }),
);
// Future reporting contract, not an assertion that a backend analytics endpoint exists.
export const dashboardAnalyticsSchema = z.object({
  sales: periods,
  paymentVolume: periods,
  paymentStatus: slices,
  packageSales: slices,
  totals: z.object({
    purchases: z.number().int().nonnegative(),
    revenue: money,
    codesSold: z.number().int().nonnegative(),
    availableCodes: z.number().int().nonnegative(),
  }),
});
export type DashboardAnalytics = z.infer<typeof dashboardAnalyticsSchema>;
export type AnalyticsPeriod = "daily" | "weekly" | "monthly";
export function useDashboardAnalytics() {
  return useQuery<DashboardAnalytics | null>({
    queryKey: ["admin", "dashboard", "analytics"],
    // No reporting API exists. Do not invent a URL or aggregate paginated business records.
    // Replace this adapter with authenticated adminFetch + schema validation when reporting is added.
    queryFn: () => Promise.resolve(null),
    staleTime: Infinity,
    retry: false,
  });
}
