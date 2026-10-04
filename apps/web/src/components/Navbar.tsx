"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#packages", label: "Buy Wi-Fi" },
  { href: "/#how-it-works", label: "How It Works" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [openedPath, setOpenedPath] = useState("");
  const pathname = usePathname();
  const expanded = open && openedPath === pathname;
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    }
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [expanded]);

  return (
    <>
      <Link
        className="absolute -top-20 left-5 z-50 bg-white p-3 focus:top-3"
        href="#main-content"
      >
        Skip to content
      </Link>
      <header className="relative z-30 border-b border-line bg-white/95">
        <div className="mx-auto flex min-h-[68px] w-[calc(100%-40px)] max-w-[1080px] items-center justify-between md:min-h-[76px] md:w-[calc(100%-64px)]">
          <Brand />
          <nav
            className="hidden items-center gap-[30px] text-sm font-semibold md:flex"
            aria-label="Main navigation"
          >
            {links.map(({ href, label }) => (
              <Link
                className="transition-colors hover:text-brand motion-reduce:transition-none first:text-brand"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#b9d1ff] bg-white px-5 py-2 text-brand-dark transition-colors hover:bg-[#eef5ff] motion-reduce:transition-none"
              href="/payment/check"
            >
              Check Payment
            </Link>
          </nav>
          <div
            className="relative md:hidden"
            ref={menu}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setOpen(false);
            }}
          >
            <button
              ref={toggle}
              className="inline-flex size-11 items-center justify-center rounded-lg border border-[#b9d1ff] text-brand-dark transition-colors hover:bg-blue-50 motion-reduce:transition-none"
              type="button"
              aria-label={
                expanded ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={expanded}
              aria-controls="mobile-navigation"
              onClick={() => {
                setOpenedPath(pathname);
                setOpen(!expanded);
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {expanded ? (
                  <path d="m6 6 12 12M6 18 18 6" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <nav
              id="mobile-navigation"
              hidden={!expanded}
              className="absolute top-[52px] right-0 w-[min(240px,calc(100vw-40px))] rounded-xl border border-line bg-white p-3 shadow-[0_10px_30px_#07153422]"
              aria-label="Mobile navigation"
            >
              {links.map(({ href, label }) => (
                <Link
                  className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-blue-50 hover:text-brand"
                  href={href}
                  key={href}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <Link
                className="mt-2 block rounded-lg bg-blue-50 px-3 py-3 text-sm font-semibold text-brand-dark hover:bg-blue-100"
                href="/payment/check"
                onClick={() => setOpen(false)}
              >
                Check Payment
              </Link>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
