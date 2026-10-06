import type { ComponentPropsWithoutRef } from "react";
export function PaymentCard({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={
        "w-full max-w-[540px] rounded-[20px] border border-line bg-surface px-5 py-[26px] text-center shadow-payment-panel md:p-9 [&_h1]:mt-[18px] [&_h1]:mb-3.5 [&_h1]:text-[28px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:tracking-tight md:[&_h1]:text-[32px] [&_p]:mb-5 [&_p:not([role=alert])]:text-muted [&_form]:mt-[26px] [&_form]:text-left [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-1 [&_dl]:gap-[5px] [&_dl]:text-left [&_dl]:text-sm md:[&_dl]:grid-cols-[120px_1fr] md:[&_dl]:gap-3 [&_dt]:text-muted [&_dd]:mb-3 [&_dd]:font-semibold [&_dd]:[overflow-wrap:anywhere] md:[&_dd]:mb-0" +
        " " +
        className
      }
    />
  );
}
