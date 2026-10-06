import type { ComponentPropsWithRef } from "react";

export const panelStyles =
  "rounded-panel border border-line bg-surface shadow-panel";
export function Panel({
  className = "",
  ...props
}: ComponentPropsWithRef<"div">) {
  return <div {...props} className={`${panelStyles} ${className}`} />;
}
