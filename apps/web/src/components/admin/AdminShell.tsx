"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../Icon";
import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { useAdminLogout } from "@/lib/queries";
import type { AdminIdentity } from "@/lib/schemas/admin";
const Identity = createContext<AdminIdentity | null>(null);
export function useAdminIdentity() {
  const admin = useContext(Identity);
  if (!admin) throw new Error("Admin identity unavailable");
  return admin;
}
const navigation: { label: string; href?: string; icon: AdminIconName }[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Packages", href: "/admin/packages", icon: "package" },
  { label: "Access Codes", href: "/admin/access-codes", icon: "codes" },
  { label: "Purchases", href: "/admin/purchases", icon: "purchases" },
  { label: "Payments", href: "/admin/payments", icon: "payments" },
];
export function AdminShell({
  admin,
  children,
}: {
  admin: AdminIdentity;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const logout = useAdminLogout();
  const drawer = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  async function signOut() {
    try {
      await logout.mutateAsync();
      client.clear();
      router.replace("/admin/login");
      router.refresh();
    } catch {}
  }
  function sidebar(mobile = false) {
    const compact = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col bg-[#0d1e34] px-3 py-6 text-slate-200">
        <Link
          href="/admin"
          onClick={() => drawer.current?.close()}
          className="mb-9 flex items-center gap-3 px-3 text-white"
          aria-label="Anka WiFi Admin Panel"
        >
          <Icon className="size-10 shrink-0 text-[#3a7cff]" />
          {!compact && (
            <span>
              <span className="block text-xl font-bold tracking-tight">
                Anka WiFi
              </span>
              <span className="text-xs text-slate-300">Admin Panel</span>
            </span>
          )}
        </Link>
        <nav aria-label="Admin navigation" className="space-y-2">
          {navigation.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => drawer.current?.close()}
                aria-current={pathname === item.href ? "page" : undefined}
                title={compact ? item.label : undefined}
                className={`flex min-h-12 items-center gap-4 rounded-lg px-4 text-sm font-medium transition-colors ${pathname === item.href ? "bg-[#2465dc] text-white shadow-sm" : "hover:bg-white/10"}`}
              >
                <AdminIcon name={item.icon} className="shrink-0" />
                {!compact && item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                title={item.label + " — coming soon"}
                aria-disabled="true"
                className="flex min-h-12 items-center gap-4 px-4 text-sm text-slate-400"
              >
                <AdminIcon name={item.icon} className="shrink-0" />
                {!compact && (
                  <span>
                    {item.label}
                    <span className="ml-2 text-[10px] uppercase tracking-wide">
                      Soon
                    </span>
                  </span>
                )}
              </span>
            ),
          )}
        </nav>
        <div className="mt-auto pt-12">
          <div className="flex items-center gap-3 overflow-hidden px-3 pb-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-semibold text-white">
              {admin.name.charAt(0).toUpperCase()}
            </span>
            {!compact && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {admin.name}
                </p>
                <p className="truncate text-xs text-slate-300">{admin.email}</p>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 pt-3">
            <button
              onClick={signOut}
              disabled={logout.isPending}
              aria-label="Logout"
              className="flex w-full items-center gap-4 rounded-lg px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              <AdminIcon name="logout" />
              {!compact && (logout.isPending ? "Signing out…" : "Logout")}
            </button>
            {logout.isError && (
              <p role="alert" className="px-3 text-xs text-red-200">
                Sign out failed. Try again.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <Identity.Provider value={admin}>
      <div className="min-h-screen bg-[#f5f8fc] text-[#081733]">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden lg:block ${collapsed ? "w-20" : "w-64"}`}
        >
          {sidebar()}
        </aside>
        <dialog
          ref={drawer}
          className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-[#0d1e34] p-0 text-white backdrop:bg-slate-950/50"
          aria-label="Admin navigation"
        >
          <div className="absolute right-3 top-2">
            <button
              aria-label="Close navigation"
              className="p-2 text-xl"
              onClick={() => drawer.current?.close()}
            >
              ×
            </button>
          </div>
          {sidebar(true)}
        </dialog>
        <div className={`min-w-0 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
          <header className="flex h-16 items-center justify-between border-b border-line bg-white/90 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
                onClick={() => drawer.current?.showModal()}
              >
                <AdminIcon name="menu" />
              </button>
              <button
                className="hidden rounded-lg p-2 hover:bg-slate-100 lg:block"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed(!collapsed)}
              >
                <AdminIcon name="menu" />
              </button>
              <span className="text-sm text-muted">
                Anka WiFi <span className="mx-2 text-slate-300">/</span>{" "}
                {navigation.find((item) => item.href === pathname)?.label ??
                  "Overview"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                {admin.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:inline">
                {admin.name}
              </span>
            </div>
          </header>
          <main id="admin-main" className="mx-auto max-w-[1600px] p-5 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </Identity.Provider>
  );
}
