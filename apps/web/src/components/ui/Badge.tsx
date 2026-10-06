import type { ComponentPropsWithoutRef } from "react";

const tones = {
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  info: "bg-info-soft text-info-strong",
  purple: "bg-purple-soft text-purple-strong",
  neutral: "bg-neutral-soft text-neutral-strong",
};
export type BadgeTone = keyof typeof tones;
export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      {...props}
      className={`inline-flex rounded-control px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    />
  );
}
