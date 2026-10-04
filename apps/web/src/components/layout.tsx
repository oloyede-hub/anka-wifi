import Link from "next/link";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
export { Brand } from "./Brand";
export { Navbar } from "./Navbar";

export function Footer() {
  return (
    <footer className="border-t border-line py-5.5">
      <div className="mx-auto flex w-[calc(100%-40px)] max-w-270 flex-col items-start justify-between gap-5 md:w-[calc(100%-64px)] md:flex-row md:items-center">
        <div>
          <Brand />
          <p className="-mt-1 pl-12 text-xs text-muted">
            Fast. Secure. Simple.
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center gap-6 text-xs text-muted md:gap-7.5"
          aria-label="Footer navigation"
        >
          <Link className="hover:text-brand" href="/#home">
            Home
          </Link>
          <Link className="hover:text-brand" href="/#packages">
            Buy Wi-Fi
          </Link>
          <Link className="hover:text-brand" href="/#how-it-works">
            How It Works
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-5 flex w-[calc(100%-40px)] max-w-270 flex-col items-start justify-between border-t border-line pt-1 text-xs text-muted md:w-[calc(100%-64px)] md:flex-row md:items-center">
        <p>© {new Date().getFullYear()} Anka WiFi</p>
        <Link
          className="inline-flex min-h-9 items-center gap-1.5 hover:text-navy"
          href="/admin/login"
        >
          <Icon name="lock" className="size-3.5" />
          Admin Login
        </Link>
      </div>
    </footer>
  );
}
