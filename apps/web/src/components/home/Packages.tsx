"use client";
import { FeedbackCard } from "@/components/ui/FeedbackCard";
import { Button } from "@/components/ui/Button";

import { useState } from "react";
import type { WifiPackage } from "@/lib/api";
import { usePackages } from "@/lib/queries";
import { formatNaira, packageLabel } from "@/lib/formatting";
import { Icon } from "../Icon";
import { PurchaseDialog } from "./PurchaseDialog";

export function Packages() {
  const catalog = usePackages();
  const packages = catalog.data ?? [];
  const [selected, setSelected] = useState<WifiPackage | null>(null);
  return (
    <section
      className="mx-auto w-[calc(100%-40px)] max-w-[1080px] md:w-[calc(100%-64px)] pt-11 pb-[30px]"
      id="packages"
    >
      <div className="mb-7 text-center [&_h2]:text-[29px] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-tight md:[&_h2]:text-[32px] [&_p:last-child]:mt-2.5 [&_p:last-child]:text-[15px] [&_p:last-child]:text-muted">
        <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-eyebrow [&_span]:px-[7px]">
          CHOOSE A PLAN
        </p>
        <h2>Wi-Fi Packages</h2>
        <p>
          Select a package that fits your needs.
          <br />
          Your next connection starts here.
        </p>
      </div>
      {catalog.isPending && (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6"
          role="status"
          aria-label="Loading Wi-Fi packages"
        >
          {[0, 1, 2].map((i) => (
            <div
              className="relative flex min-h-[310px] flex-col rounded-xl border bg-surface px-7 pb-6 pt-7 shadow-package transition-shadow hover:shadow-package-hover motion-reduce:transition-none md:min-h-[335px] md:px-5 lg:px-7 border-line motion-safe:animate-pulse [&_div]:mb-5 [&_div]:h-5 [&_div]:rounded-md [&_div]:bg-surface-soft [&_div:nth-child(3)]:h-[90px]"
              key={i}
            >
              <div />
              <div />
              <div />
              <div />
            </div>
          ))}
        </div>
      )}
      {catalog.isError && (
        <FeedbackCard role="alert">
          <h3>Packages couldn’t load</h3>
          <p>Please check your connection and try again.</p>
          <Button
            variant="primary"
            size="lg"
            className="shadow-action"
            disabled={catalog.isFetching}
            onClick={() => void catalog.refetch()}
          >
            Try Again
          </Button>
        </FeedbackCard>
      )}
      {catalog.isSuccess &&
        (packages.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            {packages.map((item) => (
              <article
                className={`relative flex min-h-[310px] flex-col rounded-xl border bg-surface px-7 pb-6 pt-7 shadow-package transition-shadow hover:shadow-package-hover motion-reduce:transition-none md:min-h-[335px] md:px-5 lg:px-7 [&_h3]:mb-1.5 [&_h3]:pr-6 [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:tracking-tight md:[&_h3]:text-[21px] [&_p]:text-[15px] [&_p]:text-muted md:[&_p]:text-sm [&_ul]:mb-[25px] [&_ul]:grid [&_ul]:gap-2 [&_ul]:text-[15px] [&_ul]:text-body-secondary md:[&_ul]:text-sm [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li_svg]:size-[17px] [&_li_svg]:shrink-0 [&_li_svg]:rounded-full [&_li_svg]:bg-feature-success [&_li_svg]:p-0.5 [&_li_svg]:text-on-dark ${item.featured ? "border-brand-selected pt-12 shadow-package-selected" : "border-line md:pt-[34px]"}`}
                key={item.id}
              >
                {item.featured && (
                  <span className="absolute top-[9px] left-7 rounded-full bg-brand px-3.5 py-0.5 text-[11px] text-on-dark">
                    Featured Plan
                  </span>
                )}
                <span
                  className={`absolute top-[34px] right-[25px] size-[22px] rounded-full ${item.featured ? "border-[6px] border-brand" : "border-2 border-control-outline"}`}
                  aria-hidden="true"
                />
                <h3>{item.name}</h3>
                <p>{item.description || packageLabel[item.type]}</p>
                <div className="mt-[18px] mb-3 text-[34px] font-extrabold tracking-tight">
                  {formatNaira(String(item.price))}
                </div>
                <ul>
                  <li>
                    <Icon name="check" />
                    {packageLabel[item.type]}
                  </li>
                  <li>
                    <Icon name="check" />
                    Secure payment with Paystack or OPay
                  </li>
                  <li>
                    <Icon name="check" />
                    Access code after confirmation
                  </li>
                </ul>
                <Button
                  variant={item.featured ? "primary" : "soft"}
                  size="lg"
                  className={`mt-auto w-full ${item.featured ? "shadow-action" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  Select Plan
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <FeedbackCard>
            <Icon />
            <h3>No Wi-Fi packages are currently available.</h3>
            <p>Please check back soon.</p>
          </FeedbackCard>
        ))}
      {selected && (
        <PurchaseDialog
          key={selected.id}
          wifiPackage={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
