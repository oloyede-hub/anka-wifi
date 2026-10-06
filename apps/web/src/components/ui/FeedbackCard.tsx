import type { ComponentPropsWithoutRef } from "react";

export function FeedbackCard({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`rounded-panel border border-line bg-surface-subtle p-9 text-center [&_h1]:my-4 [&_h1]:text-[32px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h3]:text-xl [&_h3]:font-bold [&_p]:mt-3 [&_p]:mb-5 [&_p]:text-muted [&>svg]:mx-auto [&>svg]:mb-4 [&>svg]:text-brand ${className}`}
    />
  );
}
