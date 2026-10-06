import type { ComponentPropsWithRef } from "react";

const variants = {
  primary: "border-brand bg-brand text-on-dark hover:bg-brand-dark",
  secondary: "border-line bg-surface hover:bg-surface-muted",
  outline:
    "border-brand-border bg-surface text-brand-dark hover:bg-brand-hover",
  soft: "border-transparent bg-surface-soft text-navy hover:bg-button-soft-hover",
  ghost: "border-transparent hover:bg-surface-soft",
  link: "border-transparent text-brand hover:underline",
  plain: "",
};
const sizes = {
  sm: "rounded-control px-3 py-2 text-xs",
  md: "rounded-control px-4 py-2.5 text-sm font-medium",
  lg: "min-h-[49px] gap-3.5 rounded-panel px-6 py-3 text-sm font-semibold",
  icon: "size-11 rounded-control p-2",
  nav: "min-h-10 rounded-control px-5 py-2 text-sm font-medium",
  none: "",
};
export type ButtonVariant = keyof typeof variants;
export function buttonStyles({
  variant = "secondary",
  size = "md",
  className = "",
  shape = "rounded",
}: {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  className?: string;
  shape?: "rounded" | "pill";
} = {}) {
  const base =
    variant === "plain"
      ? ""
      : "inline-flex items-center justify-center border transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50";
  const dimensions =
    shape === "pill"
      ? sizes[size].replace(/rounded-\S+/g, "rounded-full")
      : sizes[size];
  return [base, variants[variant], dimensions, className]
    .filter(Boolean)
    .join(" ");
}
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  shape?: "rounded" | "pill";
};
export function Button({
  variant,
  size,
  shape,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={buttonStyles({ variant, size, shape, className })}
    />
  );
}
