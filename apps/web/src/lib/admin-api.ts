import { ApiError } from "./api";
import type { AdminIdentity, AdminLoginValues } from "./schemas/admin";

export interface AdminLoginResult {
  admin: AdminIdentity;
  expiresIn: number;
}
export async function loginAdmin(
  values: AdminLoginValues,
): Promise<AdminLoginResult> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<AdminLoginResult>;
}
export async function logoutAdmin(): Promise<void> {
  const response = await fetch("/api/admin/login", {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
}
