import Link from "next/link";
import { Icon } from "./Icon";

export function Brand() {
  return (
    <Link
      className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight md:text-[22px] [&_svg]:size-[38px] [&_svg]:text-brand"
      href="/"
      aria-label="Anka WiFi home"
    >
      <Icon />
      <span>Anka WiFi</span>
    </Link>
  );
}
