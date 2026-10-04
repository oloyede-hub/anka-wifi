"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { panelClass, StatCard } from "./AdminUI";
export const inputClass =
  "min-w-0 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50";
const buttonBase =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50";
export const buttonClass =
  buttonBase + " border-line bg-white hover:bg-slate-50";
export const primaryClass =
  buttonBase + " border-brand bg-brand text-white hover:bg-brand-dark";
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
        <button className={buttonClass} onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
export function UnavailableSummary({
  title,
  statuses,
}: {
  title: string;
  statuses: readonly string[];
}) {
  return (
    <div className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          "Total " + title,
          ...statuses.map((s) => s.charAt(0) + s.slice(1).toLowerCase()),
        ].map((label, index) => (
          <StatCard
            key={label}
            label={label}
            value="—"
            detail="Aggregate unavailable"
            icon={index === 0 ? "payments" : "check"}
            tone={
              label === "Pending"
                ? "amber"
                : label === "Failed"
                  ? "red"
                  : ["Completed", "Successful"].includes(label)
                    ? "green"
                    : "blue"
            }
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        The API returns pages without aggregate totals. These cards do not count
        only the current page.
      </p>
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
        <button
          key={status}
          aria-pressed={value === status}
          onClick={() => change(status)}
          className={`rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand ${value === status ? "bg-blue-50 font-medium text-brand" : "text-muted hover:bg-slate-50"}`}
        >
          {status ? status.charAt(0) + status.slice(1).toLowerCase() : "All"}
        </button>
      ))}
    </div>
  );
}
export function Pagination({
  page,
  count,
  hasNext,
  busy,
  change,
  total,
}: {
  page: number;
  count: number;
  hasNext: boolean;
  busy: boolean;
  change: (page: number) => void;
  total?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
      <p>
        {count
          ? `Showing ${page * 10 + 1}–${page * 10 + count}${total !== undefined ? ` of ${total}` : ""}`
          : "No results"}
      </p>
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          onClick={() => change(page - 1)}
          disabled={busy || page === 0}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className={buttonClass}
          onClick={() => change(page + 1)}
          disabled={busy || !hasNext || page >= 10000}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function CopyCode({ code }: { code: string }) {
  const [feedback, setFeedback] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all font-mono text-sm">{code}</code>
      <button
        className="rounded border border-line px-2 py-1 text-xs text-brand hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-brand"
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
      </button>
      <span role="status" className="text-xs text-muted">
        {feedback}
      </span>
    </div>
  );
}
export function Sheet({
  title,
  children,
  trigger,
  onClose,
}: {
  title: string;
  children: ReactNode;
  trigger?: (open: () => void) => ReactNode;
  onClose?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return (
    <>
      {trigger?.(() => setOpen(true))}
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-full border-0 bg-white p-0 text-navy shadow-2xl backdrop:bg-slate-950/40 sm:w-[470px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white p-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            className={buttonClass}
            aria-label={`Close ${title}`}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        <div className="space-y-5 p-5">{children}</div>
      </dialog>
    </>
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
  return <div className={panelClass + " min-w-0 p-4 sm:p-5"}>{children}</div>;
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
