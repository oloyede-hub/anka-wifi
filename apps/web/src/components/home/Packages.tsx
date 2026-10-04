"use client";
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
        <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#607394] [&_span]:px-[7px]">
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
              className="relative flex min-h-[310px] flex-col rounded-xl border bg-white px-7 pb-6 pt-7 shadow-[0_5px_18px_#162a4910] transition-shadow hover:shadow-[0_8px_24px_#162a491a] motion-reduce:transition-none md:min-h-[335px] md:px-5 lg:px-7 border-line motion-safe:animate-pulse [&_div]:mb-5 [&_div]:h-5 [&_div]:rounded-md [&_div]:bg-slate-100 [&_div:nth-child(3)]:h-[90px]"
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
        <div
          className="rounded-xl border border-line bg-[#f8fbff] p-9 text-center [&_h1]:my-4 [&_h1]:text-[32px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h3]:text-xl [&_h3]:font-bold [&_p]:mt-3 [&_p]:mb-5 [&_p]:text-muted [&>svg]:mx-auto [&>svg]:mb-4 [&>svg]:text-brand"
          role="alert"
        >
          <h3>Packages couldn’t load</h3>
          <p>Please check your connection and try again.</p>
          <button
            className="inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark"
            disabled={catalog.isFetching}
            onClick={() => void catalog.refetch()}
          >
            Try Again
          </button>
        </div>
      )}
      {catalog.isSuccess &&
        (packages.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            {packages.map((item) => (
              <article
                className={`relative flex min-h-[310px] flex-col rounded-xl border bg-white px-7 pb-6 pt-7 shadow-[0_5px_18px_#162a4910] transition-shadow hover:shadow-[0_8px_24px_#162a491a] motion-reduce:transition-none md:min-h-[335px] md:px-5 lg:px-7 [&_h3]:mb-1.5 [&_h3]:pr-6 [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:tracking-tight md:[&_h3]:text-[21px] [&_p]:text-[15px] [&_p]:text-muted md:[&_p]:text-sm [&_ul]:mb-[25px] [&_ul]:grid [&_ul]:gap-2 [&_ul]:text-[15px] [&_ul]:text-[#43516b] md:[&_ul]:text-sm [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li_svg]:size-[17px] [&_li_svg]:shrink-0 [&_li_svg]:rounded-full [&_li_svg]:bg-[#4f9d65] [&_li_svg]:p-0.5 [&_li_svg]:text-white ${item.featured ? "border-[#accaff] pt-12 shadow-[0_6px_20px_#1768ff17]" : "border-line md:pt-[34px]"}`}
                key={item.id}
              >
                {item.featured && (
                  <span className="absolute top-[9px] left-7 rounded-full bg-brand px-3.5 py-0.5 text-[11px] text-white">
                    Featured Plan
                  </span>
                )}
                <span
                  className={`absolute top-[34px] right-[25px] size-[22px] rounded-full ${item.featured ? "border-[6px] border-brand" : "border-2 border-[#bdcadd]"}`}
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
                    Secure payment with Paystack
                  </li>
                  <li>
                    <Icon name="check" />
                    Access code after confirmation
                  </li>
                </ul>
                <button
                  className={`inline-flex min-h-[49px] items-center justify-center gap-3.5 rounded-xl border border-transparent px-6 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 mt-auto w-full ${item.featured ? "bg-brand text-white shadow-[0_8px_24px_#1768ff18] hover:bg-brand-dark" : "bg-slate-100 text-navy hover:bg-[#e5edfa]"}`}
                  onClick={() => setSelected(item)}
                >
                  Select Plan
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-[#f8fbff] p-9 text-center [&_h1]:my-4 [&_h1]:text-[32px] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h3]:text-xl [&_h3]:font-bold [&_p]:mt-3 [&_p]:mb-5 [&_p]:text-muted [&>svg]:mx-auto [&>svg]:mb-4 [&>svg]:text-brand">
            <Icon />
            <h3>No Wi-Fi packages are currently available.</h3>
            <p>Please check back soon.</p>
          </div>
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
