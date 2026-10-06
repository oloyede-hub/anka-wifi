"use client";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

import { useDashboardAnalytics } from "@/lib/admin-analytics";
import { useState, type ReactNode } from "react";
import { StatCard, QueryError } from "./AdminUI";
export function OperationHeading({
  title,
  subtitle,
  refreshing,
  refresh,
  children,
}: {
  title: string;
  subtitle: string;
  refreshing: boolean;
  refresh: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        <Button
          variant="secondary"
          size="md"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
export function DataSummary({
  title,
  statuses,
  resource,
}: {
  title: string;
  statuses: readonly string[];
  resource: "purchases" | "payments" | "accessCodes";
}) {
  const query = useDashboardAnalytics();
  const summary = query.data?.summaries[resource];
  return (
    <div className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {["", ...statuses].map((status) => (
          <StatCard
            key={status}
            label={
              status
                ? status.charAt(0) + status.slice(1).toLowerCase()
                : "Total " + title
            }
            value={
              query.isPending
                ? "\u2026"
                : !summary
                  ? "\u2014"
                  : status
                    ? (summary.statuses as Record<string, number>)[status]
                    : summary.total
            }
            detail={
              query.isPending
                ? "Loading totals"
                : query.isError
                  ? "Could not load totals"
                  : "All-time business totals"
            }
            icon={
              resource === "accessCodes"
                ? "codes"
                : resource === "purchases"
                  ? "purchases"
                  : "payments"
            }
            tone={
              ["COMPLETED", "SUCCESSFUL", "AVAILABLE"].includes(status)
                ? "green"
                : ["PENDING", "RESERVED"].includes(status)
                  ? "amber"
                  : ["FAILED", "DISABLED"].includes(status)
                    ? "red"
                    : status === "SOLD"
                      ? "purple"
                      : "blue"
            }
          />
        ))}
      </div>
      {query.isError && (
        <div className="mt-3">
          <QueryError error={query.error} retry={() => void query.refetch()} />
        </div>
      )}
    </div>
  );
}
export function StatusTabs({
  statuses,
  value,
  change,
}: {
  statuses: readonly string[];
  value: string;
  change: (status: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-line pb-2"
      aria-label="Status filters"
    >
      {["", ...statuses].map((status) => (
        <Button
          variant="plain"
          size="none"
          key={status}
          aria-pressed={value === status}
          onClick={() => change(status)}
          className={`rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand ${value === status ? "bg-info-soft font-medium text-brand" : "text-muted hover:bg-surface-muted"}`}
        >
          {status ? status.charAt(0) + status.slice(1).toLowerCase() : "All"}
        </Button>
      ))}
    </div>
  );
}
export function CopyCode({ code }: { code: string }) {
  const [feedback, setFeedback] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all font-mono text-sm">{code}</code>
      <Button
        variant="plain"
        size="none"
        className="rounded border border-line px-2 py-1 text-xs text-brand hover:bg-info-soft focus-visible:outline-2 focus-visible:outline-brand"
        aria-label={`Copy code ${code}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setFeedback("Copied");
          } catch {
            setFeedback("Copy unavailable. Select the code to copy.");
          }
        }}
      >
        Copy
      </Button>
      <span role="status" className="text-xs text-muted">
        {feedback}
      </span>
    </div>
  );
}
export function DataPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-line pb-5">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 text-sm">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="break-words">{children ?? "Not available"}</div>
    </div>
  );
}
export function EmptyState({
  text = "No matching records found.",
}: {
  text?: string;
}) {
  return <p className="py-12 text-center text-sm text-muted">{text}</p>;
}
export function TableFrame({ children }: { children: ReactNode }) {
  return <Panel className="min-w-0 p-4 sm:p-5">{children}</Panel>;
}
export function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : new Intl.DateTimeFormat("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }).format(date);
}
