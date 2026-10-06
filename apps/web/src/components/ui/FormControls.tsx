import type { ComponentPropsWithRef } from "react";

export const controlStyles =
  "min-w-0 w-full rounded-control border border-control bg-surface px-3 py-2.5 text-sm text-navy outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-surface-disabled disabled:opacity-50";

// Native props (including RHF's ref/name/onChange/onBlur) pass through unchanged.
export function Input({
  className = "",
  type,
  ...props
}: ComponentPropsWithRef<"input">) {
  const choice = type === "checkbox" || type === "radio";
  return (
    <input
      {...props}
      type={type}
      className={[choice ? "accent-brand" : controlStyles, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
export function Select({
  className = "",
  ...props
}: ComponentPropsWithRef<"select">) {
  return (
    <select
      {...props}
      className={[controlStyles, className].filter(Boolean).join(" ")}
    />
  );
}
export function Textarea({
  className = "",
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={[controlStyles, "resize-y", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
