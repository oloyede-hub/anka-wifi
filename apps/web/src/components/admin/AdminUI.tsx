import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { adminError } from "@/lib/admin-management";
export const panelClass =
  "rounded-xl border border-line bg-white shadow-[0_3px_16px_rgba(30,64,110,0.035)]";
export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: AdminIconName;
  tone?: "blue" | "green" | "amber" | "purple" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-brand",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-500",
    purple: "bg-violet-50 text-violet-600",
    red: "bg-rose-50 text-rose-600",
  };
  return (
    <div className={panelClass + " flex items-start gap-5 p-5 xl:p-6"}>
      <span
        className={`grid size-14 shrink-0 place-items-center rounded-[20px] ${tones[tone]}`}
      >
        <AdminIcon name={icon} className="size-7" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 break-words text-[28px] font-bold tracking-tight">
          {value === "…" ? (
            <span
              role="status"
              aria-label={"Loading " + label}
              className="mt-2 block h-7 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
            />
          ) : (
            value
          )}
        </p>
        <p className="mt-2 text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const color = ["ACTIVE", "AVAILABLE", "COMPLETED", "SUCCESSFUL"].includes(
    status,
  )
    ? "bg-emerald-50 text-emerald-700"
    : ["PENDING", "RESERVED"].includes(status)
      ? "bg-amber-50 text-amber-700"
      : ["FAILED", "INACTIVE", "DISABLED"].includes(status)
        ? "bg-rose-50 text-rose-600"
        : status === "SOLD"
          ? "bg-violet-50 text-violet-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${color}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
export function QueryError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg bg-rose-50 p-5 text-sm text-rose-700"
    >
      <p>{adminError(error)}</p>
      <button onClick={retry} className="mt-2 font-semibold underline">
        Retry
      </button>
    </div>
  );
}
export function RowsSkeleton() {
  return (
    <div role="status" aria-label="Loading data" className="space-y-4 p-5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className="h-10 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}
