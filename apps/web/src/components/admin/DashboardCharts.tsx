"use client";
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
const colors = [
  "#246bff",
  "#21a45d",
  "#ffaf32",
  "#8859ef",
  "#e44f69",
  "#64748b",
];
function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-5 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-blue-50 text-brand">
        <AdminIcon name="chart" />
      </span>
      <p className="max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}
function ChartSkeleton() {
  return (
    <div
      className="mt-5 h-64 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"
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
            <button
              key={value}
              disabled={!query.data}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-45 ${period === value && query.data ? "bg-brand text-white" : "text-muted"}`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>
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
                    <stop offset="0%" stopColor="#246bff" stopOpacity={0.22} />
                    <stop
                      offset="100%"
                      stopColor="#246bff"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8eef7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#61718f", fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  width={64}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#61718f", fontSize: 11 }}
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
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: "#e7edf5",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plottedAmount"
                  stroke="#246bff"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  dot={{ r: 3, fill: "#246bff" }}
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
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: "#e7edf5",
                    fontSize: 12,
                  }}
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
                <strong>{item.count.toLocaleString("en-NG")}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
