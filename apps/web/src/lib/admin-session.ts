import "server-only";
import { cookies } from "next/headers";
import { adminIdentitySchema } from "./schemas/admin";
export async function getAdminSession() {
  const token = (await cookies()).get("anka-admin-session")?.value;
  if (!token) return null;
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    throw new Error(
      "Admin service is unavailable. Check the API configuration.",
    );
  const response = await fetch(base.replace(/\/$/, "") + "/admin/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok)
    throw new Error("Admin service is temporarily unavailable.");
  return adminIdentitySchema.parse(await response.json());
}
