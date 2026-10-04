"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import {
  adminPackageSchema,
  recentPurchaseSchema,
  type PackageFormValues,
} from "./schemas/admin-package";
import { z } from "zod";
import { useRouter } from "next/navigation";
export async function adminFetch(path: string, init?: RequestInit) {
  const response = await fetch("/api/admin/" + path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<unknown>;
}
export function useAuthenticatedFetch() {
  const router = useRouter();
  const client = useQueryClient();
  return async (path: string, init?: RequestInit) => {
    try {
      return await adminFetch(path, init);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        client.removeQueries({ queryKey: ["admin"] });
        router.replace("/admin/login");
        router.refresh();
      }
      throw error;
    }
  };
}
export function useAdminPackages() {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "packages"],
    queryFn: async ({ signal }) => {
      const all = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const page = z
          .array(adminPackageSchema)
          .parse(await request("packages?offset=" + offset, { signal }));
        all.push(...page);
        if (page.length < 100) return { items: all, complete: true };
      }
      return { items: all, complete: false };
    },
    retry: false,
  });
}
export function useRecentPurchases() {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "dashboard", "recent-purchases"],
    queryFn: async ({ signal }) =>
      z
        .array(recentPurchaseSchema)
        .parse(await request("purchases", { signal })),
    retry: false,
  });
}
export function useSavePackage() {
  const client = useQueryClient();
  const request = useAuthenticatedFetch();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id?: string;
      values: PackageFormValues | { status: "ACTIVE" | "INACTIVE" };
    }) =>
      request(id ? "packages/" + encodeURIComponent(id) : "packages", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "packages"] }),
        client.invalidateQueries({ queryKey: ["packages"] }),
        client.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]);
    },
  });
}
export function adminError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "You don’t have permission to complete this action.";
    if (error.status === 404)
      return "This record no longer exists. Refresh the list.";
    if (error.status === 400) return "Check the details and try again.";
    if (error.status === 409)
      return "This code already exists or is no longer available for this operation. Refresh and try again.";
    if (error.status === 429) return "Too many requests. Please wait a minute.";
  }
  return "We couldn’t reach the admin service. Please try again.";
}
