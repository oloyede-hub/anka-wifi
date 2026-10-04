// Preserve Prisma Decimal strings without floating point conversion.
export function formatNaira(price: string): string {
  if (!/^\d+(\.\d{1,2})?$/.test(price)) return "Price unavailable";
  const [whole, fraction = ""] = price.split(".");
  const decimals = fraction.padEnd(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${decimals === "00" ? "" : `.${decimals}`}`;
}
export const packageLabel = {
  DAILY: "Daily Access",
  WEEKLY: "Weekly Access",
  MONTHLY: "Monthly Access",
};
