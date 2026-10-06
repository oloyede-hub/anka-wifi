"use client";
import { Button } from "@/components/ui/Button";

import { chartTheme } from "@/lib/chart-theme";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useDashboardAnalytics,
  type AnalyticsPeriod,
} from "@/lib/admin-analytics";
import { formatNaira } from "@/lib/formatting";
import { panelClass, QueryError } from "./AdminUI";
import { AdminIcon } from "./AdminIcon";
const colors = chartTheme.palette;
function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-5 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-info-soft text-brand">
        <AdminIcon name="chart" />
      </span>
      <p className="max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}
function ChartSkeleton() {
  return (
    <div
      className="mt-5 h-64 animate-pulse rounded-lg bg-surface-soft motion-reduce:animate-none"
      role="status"
      aria-label="Loading chart"
    >
      <span className="sr-only">Loading chart data…</span>
    </div>
  );
}
export function MoneyAreaCard({ kind }: { kind: "sales" | "paymentVolume" }) {
  const query = useDashboardAnalytics();
  const [period, setPeriod] = useState<AnalyticsPeriod>("daily");
  const gradientId = useId().replaceAll(":", "");
  const title = kind === "sales" ? "Sales Overview" : "Payment Volume";
  const points = query.data?.[kind][period] ?? [];
  // Number conversion is exclusively chart geometry. Tooltips retain the server's exact decimal string.
  const data = points.map((point) => ({
    ...point,
    plottedAmount: Number(point.amount),
  }));
  return (
    <section className={panelClass + " min-w-0 p-5"} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div
          className="flex rounded-lg border border-line p-1"
          aria-label={title + " period"}
        >
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <Button
              variant="plain"
              size="none"
              key={value}
              disabled={!query.data}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-45 ${period === value && query.data ? "bg-brand text-on-dark" : "text-muted"}`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {period === "daily"
          ? "Last 30 days"
          : period === "weekly"
            ? "Last 12 weeks"
            : "Last 12 months"}
        {" • "}
        {kind === "sales" ? "Completed purchases" : "Successful NGN payments"}
      </p>

      {query.isPending ? (
        <ChartSkeleton />
      ) : query.isError ? (
        <div className="pt-5">
          <QueryError error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : data.length === 0 ? (
        <ChartEmpty
          text={
            query.data
              ? kind === "sales"
                ? "No sales data available for this period."
                : "No payment analytics available for this period."
              : kind === "sales"
                ? "Sales analytics will appear here when reporting data is available."
                : "No payment analytics available for this period."
          }
        />
      ) : (
        <>
          <div className="mt-5 h-64 min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={data}
                margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={chartTheme.primary}
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="100%"
                      stopColor={chartTheme.primary}
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={chartTheme.tick}
                  minTickGap={24}
                />
                <YAxis
                  width={64}
                  tickLine={false}
                  axisLine={false}
                  tick={chartTheme.tick}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(Number(value))
                  }
                />
                <Tooltip
                  formatter={(_value, _name, entry) => [
                    formatNaira((entry.payload as { amount: string }).amount),
                    kind === "sales"
                      ? "Completed revenue"
                      : "Successful payment volume",
                  ]}
                  contentStyle={chartTheme.tooltip}
                />
                <Area
                  type="monotone"
                  dataKey="plottedAmount"
                  stroke={chartTheme.primary}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  dot={{ r: 3, fill: chartTheme.primary }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">View chart values</summary>
            <ul className="mt-2 space-y-1">
              {points.map((point, index) => (
                <li key={index}>
                  {point.label}: {formatNaira(point.amount)}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
export function DistributionCard({
  kind,
}: {
  kind: "paymentStatus" | "packageSales";
}) {
  const query = useDashboardAnalytics();
  const title = kind === "paymentStatus" ? "Payment Status" : "Package Sales";
  const data = query.data?.[kind] ?? [];
  const populated = data.some((item) => item.count > 0);
  return (
    <section className={panelClass + " min-w-0 p-5"} aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      {query.isPending ? (
        <ChartSkeleton />
      ) : query.isError ? (
        <div className="pt-5">
          <QueryError error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : !populated ? (
        <ChartEmpty
          text={
            !query.data
              ? kind === "packageSales"
                ? "Completed purchase distribution will appear when reporting is available."
                : "Payment status distribution will appear when reporting is available."
              : "No data available for this period."
          }
        />
      ) : (
        <>
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart accessibilityLayer>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    new Intl.NumberFormat("en-NG").format(Number(value)),
                    kind === "paymentStatus"
                      ? "Payments"
                      : "Completed purchases",
                  ]}
                  contentStyle={chartTheme.tooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-xs">
            {data.map((item, index) => (
              <li key={item.label} className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="flex-1 text-muted">{item.label}</span>
                <strong>
                  {item.count.toLocaleString("en-NG")} (
                  {Math.round(
                    (item.count /
                      data.reduce((sum, entry) => sum + entry.count, 0)) *
                      100,
                  )}
                  %)
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
