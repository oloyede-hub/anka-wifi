import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Panel, panelStyles as panelClass } from "@/components/ui/Panel";

import { Button } from "@/components/ui/Button";
import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { adminError } from "@/lib/admin-management";
export { panelClass };
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
    blue: "bg-info-soft text-brand",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    purple: "bg-purple-soft text-purple",
    red: "bg-danger-soft text-danger-strong",
  };
  return (
    <Panel className="flex items-start gap-5 p-5 xl:p-6">
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
              className="mt-2 block h-7 w-20 animate-pulse rounded bg-surface-soft motion-reduce:animate-none"
            />
          ) : (
            value
          )}
        </p>
        <p className="mt-2 text-xs text-muted">{detail}</p>
      </div>
    </Panel>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = [
    "ACTIVE",
    "AVAILABLE",
    "COMPLETED",
    "SUCCESSFUL",
  ].includes(status)
    ? "success"
    : ["PENDING", "RESERVED"].includes(status)
      ? "warning"
      : ["FAILED", "INACTIVE", "DISABLED"].includes(status)
        ? "danger"
        : status === "SOLD"
          ? "purple"
          : "neutral";
  return (
    <Badge tone={tone}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}
export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <Badge
      tone={
        provider === "OPAY"
          ? "success"
          : provider === "PAYSTACK"
            ? "info"
            : "neutral"
      }
    >
      {provider === "OPAY"
        ? "OPay"
        : provider === "PAYSTACK"
          ? "Paystack"
          : provider}
    </Badge>
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
      className="rounded-lg bg-danger-soft p-5 text-sm text-danger-deep"
    >
      <p>{adminError(error)}</p>
      <Button
        variant="plain"
        size="none"
        onClick={retry}
        className="mt-2 font-semibold underline"
      >
        Retry
      </Button>
    </div>
  );
}
export function RowsSkeleton() {
  return (
    <div role="status" aria-label="Loading data" className="space-y-4 p-5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className="h-10 animate-pulse rounded-lg bg-surface-soft motion-reduce:animate-none"
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
