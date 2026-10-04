import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { AdminShell } from "@/components/admin/AdminShell";
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
