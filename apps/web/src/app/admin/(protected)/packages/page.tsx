import { PackagesManager } from "@/components/admin/PackagesManager";
export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  return (
    <PackagesManager startCreating={(await searchParams).create === "1"} />
  );
}
