"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuthenticatedFetch } from "./admin-management";
import {
  accessCodeListSchema,
  adminPurchaseSchema,
  adminPaymentSchema,
  bulkResultSchema,
  addCodeSchema,
  bulkCodesSchema,
} from "./schemas/admin-operations";
export const PAGE_SIZE = 10;
export function useAccessCodes(filters: { status: string; packageId: string }) {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "access-codes", filters],
    retry: false,
    queryFn: async ({ signal }) => {
      const items = [];
      for (let offset = 0; offset <= 10000; offset += 100) {
        const params = new URLSearchParams({
          limit: "100",
          offset: String(offset),
        });
        if (filters.status) params.set("status", filters.status);
        if (filters.packageId) params.set("packageId", filters.packageId);
        const page = z
          .array(accessCodeListSchema)
          .parse(await request(`access-codes?${params}`, { signal }));
        if (offset === 10000 && page.length)
          throw new Error(
            "Inventory is too large for complete search. Narrow the status or package filter.",
          );
        items.push(...page);
        if (page.length < 100) return items;
      }
      return items;
    },
  });
}
export function useOperationList(
  kind: "purchases" | "payments",
  filters: Record<string, string>,
  page: number,
) {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", kind, filters, page],
    retry: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE + 1),
        offset: String(page * PAGE_SIZE),
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const data = await request(`${kind}?${params}`, { signal });
      return kind === "purchases"
        ? z.array(adminPurchaseSchema).parse(data)
        : z.array(adminPaymentSchema).parse(data);
    },
  });
}
export function usePurchase(reference: string) {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "purchase", reference],
    enabled: !!reference,
    retry: false,
    queryFn: async ({ signal }) =>
      adminPurchaseSchema.parse(
        await request(`purchases/${encodeURIComponent(reference)}`, { signal }),
      ),
  });
}
export function usePayment(reference: string) {
  const request = useAuthenticatedFetch();
  return useQuery({
    queryKey: ["admin", "payment", reference],
    enabled: !!reference,
    retry: false,
    queryFn: async ({ signal }) =>
      adminPaymentSchema.parse(
        await request(`payments/${encodeURIComponent(reference)}`, { signal }),
      ),
  });
}
export function useAddCodes(bulk: boolean) {
  const request = useAuthenticatedFetch();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: z.infer<typeof addCodeSchema> | z.infer<typeof bulkCodesSchema>,
    ) => {
      const values = (bulk ? bulkCodesSchema : addCodeSchema).parse(input);
      const result = await request(
        bulk ? "access-codes/bulk" : "access-codes",
        { method: "POST", body: JSON.stringify(values) },
      );
      return bulk ? bulkResultSchema.parse(result) : null;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin", "access-codes"] }),
  });
}
export function useDisableCode() {
  const request = useAuthenticatedFetch();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request(`access-codes/${encodeURIComponent(id)}/disable`, {
        method: "POST",
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin", "access-codes"] }),
  });
}
