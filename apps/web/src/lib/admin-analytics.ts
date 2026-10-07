"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "./admin-management";
import { dashboardAnalyticsSchema } from "./schemas/admin-report";
export {
  dashboardAnalyticsSchema,
  type DashboardAnalytics,
} from "./schemas/admin-report";
export type AnalyticsPeriod = "daily" | "weekly" | "monthly";
export function useDashboardAnalytics() {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "reports", "overview"],
    queryFn: async ({ signal }) =>
      dashboardAnalyticsSchema.parse(
        await request("reports/overview", { signal }),
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}
