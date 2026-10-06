"use client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAdminIdentity } from "./AdminShell";
import {
  StatCard,
  panelClass,
  QueryError,
  RowsSkeleton,
  StatusBadge,
  dateLabel,
} from "./AdminUI";
import { useRecentPurchases } from "@/lib/admin-management";
import { formatNaira } from "@/lib/formatting";
import { AdminIcon } from "./AdminIcon";
import { MoneyAreaCard, DistributionCard } from "./DashboardCharts";
import { useDashboardAnalytics } from "@/lib/admin-analytics";
export function Dashboard() {
  const admin = useAdminIdentity();
  const purchases = useRecentPurchases();
  const analytics = useDashboardAnalytics();
  return (
    <div className="space-y-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">
            Welcome back, {admin.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here’s what’s happening with your Wi-Fi business.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={analytics.isFetching || purchases.isFetching}
          onClick={() => {
            void analytics.refetch();
            void purchases.refetch();
          }}
        >
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          {
            label: "Total Purchases",
            icon: "purchases" as const,
            tone: "blue" as const,
          },
          {
            label: "Total Revenue",
            icon: "payments" as const,
            tone: "green" as const,
          },
          {
            label: "Codes Sold",
            icon: "codes" as const,
            tone: "amber" as const,
          },
          {
            label: "Available Codes",
            icon: "dashboard" as const,
            tone: "purple" as const,
          },
        ].map((card, index) => (
          <StatCard
            key={card.label}
            {...card}
            value={
              analytics.isPending
                ? "…"
                : analytics.data
                  ? [
                      analytics.data.totals.purchases,
                      formatNaira(analytics.data.totals.revenue),
                      analytics.data.totals.codesSold,
                      analytics.data.totals.availableCodes,
                    ][index]
                  : "—"
            }
            detail={
              analytics.data
                ? "All-time business totals"
                : analytics.isError
                  ? "Could not load totals"
                  : "Loading business totals"
            }
          />
        ))}
      </div>
      {analytics.isError && (
        <QueryError
          error={analytics.error}
          retry={() => void analytics.refetch()}
        />
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[1.75fr_1fr]">
        <div className="min-w-0 space-y-5">
          <MoneyAreaCard kind="sales" />
          <MoneyAreaCard kind="paymentVolume" />
          <section className={panelClass + " overflow-hidden"}>
            <h2 className="p-5 text-lg font-bold">Recent Purchases</h2>
            {purchases.isPending ? (
              <RowsSkeleton />
            ) : purchases.isError ? (
              <div className="p-5">
                <QueryError
                  error={purchases.error}
                  retry={() => void purchases.refetch()}
                />
              </div>
            ) : purchases.data.length === 0 ? (
              <p className="px-5 pb-10 text-sm text-muted">No purchases yet.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto px-5 pb-5 md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-muted">
                      <tr>
                        {[
                          "Reference",
                          "Package",
                          "Customer",
                          "Amount",
                          "Status",
                          "Date",
                        ].map((label) => (
                          <th key={label} className="px-3 py-3 font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.data.map((p) => (
                        <tr
                          key={p.reference}
                          className="border-b border-line last:border-0"
                        >
                          <td className="max-w-32 break-all px-3 py-4 font-medium text-brand">
                            {p.reference}
                          </td>
                          <td className="px-3 py-4">{p.package.name}</td>
                          <td className="px-3 py-4">{p.customer.phone}</td>
                          <td className="whitespace-nowrap px-3 py-4">
                            {formatNaira(p.amount)}
                          </td>
                          <td className="px-3 py-4">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-3 py-4 text-muted">
                            {dateLabel(p.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-line px-5 pb-5 md:hidden">
                  {purchases.data.map((p) => (
                    <article
                      key={p.reference}
                      className="space-y-2 py-4 text-sm"
                    >
                      <div className="flex justify-between gap-3">
                        <strong>{p.package.name}</strong>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="break-all text-xs text-brand">
                        {p.reference}
                      </p>
                      <div className="flex flex-wrap justify-between gap-2 text-muted">
                        <span>{p.customer.phone}</span>
                        <span>{formatNaira(p.amount)}</span>
                        <span>{dateLabel(p.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
        <div className="space-y-5">
          <DistributionCard kind="packageSales" />
          <DistributionCard kind="paymentStatus" />
          <section className={panelClass + " p-5"}>
            <h2 className="text-lg font-bold">Recent Activity</h2>
            {purchases.isPending ? (
              <RowsSkeleton />
            ) : purchases.isError ? (
              <QueryError
                error={purchases.error}
                retry={() => void purchases.refetch()}
              />
            ) : !purchases.data.length ? (
              <p className="mt-4 text-sm text-muted">No purchases yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {purchases.data.slice(0, 5).map((p) => (
                  <li key={p.reference} className="space-y-2 py-3 text-xs">
                    <p className="font-medium">
                      Purchase created: {p.package.name}
                    </p>
                    <p className="break-all text-muted">
                      {p.reference} ? {dateLabel(p.createdAt)}
                    </p>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-info-decoration bg-info-soft/70 p-5">
            <h2 className="mb-4 text-lg font-bold">Quick Actions</h2>
            <Link
              href="/admin/packages?create=1"
              className="flex items-center gap-3 rounded-lg border border-info-decoration bg-surface p-3 text-brand hover:border-brand"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-info-soft">
                <AdminIcon name="package" />
              </span>
              <span>
                <strong className="block text-sm">Add Package</strong>
                <span className="text-xs text-muted">
                  Create a new Wi-Fi package
                </span>
              </span>
              <AdminIcon name="plus" className="ml-auto size-5" />
            </Link>
            <p className="mt-3 text-xs text-muted">
              <Link
                href="/admin/access-codes"
                className="text-brand hover:underline"
              >
                Manage access codes
              </Link>
              {" ? "}
              <Link
                href="/admin/purchases"
                className="text-brand hover:underline"
              >
                View purchases
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
