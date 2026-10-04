export type AdminIconName =
  | "dashboard"
  | "package"
  | "codes"
  | "purchases"
  | "payments"
  | "menu"
  | "logout"
  | "search"
  | "plus"
  | "check"
  | "pause"
  | "tag"
  | "chart";
const paths: Record<AdminIconName, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  package: "m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5",
  codes: "M8 3a5 5 0 1 0 0 10h3l3 3h3v3h3v-5l-8-8 M7 7h.01",
  purchases: "M3 3h2l3 13h11l3-9H6 M9 21h.01 M18 21h.01",
  payments: "M3 5h18v14H3z M3 9h18 M7 15h4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  logout: "M9 3H4v18h5 M10 12h11 M17 8l4 4-4 4",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  plus: "M12 4v16 M4 12h16",
  check: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 12l3 3 5-6",
  pause: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 8v8 M15 8v8",
  tag: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  chart: "M4 3v18h17 M8 16v-5 M13 16V6 M18 16v-8",
};
export function AdminIcon({
  name,
  className = "",
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
