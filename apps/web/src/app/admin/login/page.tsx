import { Brand } from "@/components/Brand";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin Login | Anka WiFi",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-5 py-12"
      id="main-content"
    >
      <Brand />
      <AdminLogin />
    </main>
  );
}
