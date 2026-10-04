"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createPurchase,
  getPackages,
  initializePayment,
  validReference,
  verifyPayment,
} from "./api";
import { loginAdmin, logoutAdmin } from "./admin-api";

export function usePackages() {
  return useQuery({
    queryKey: ["packages", "active"],
    queryFn: ({ signal }) => getPackages(signal),
    select: (packages) => packages.filter((item) => item.status === "ACTIVE"),
  });
}
export function useCreatePurchase() {
  return useMutation({ mutationFn: createPurchase });
}
export function useInitializePayment() {
  return useMutation({ mutationFn: initializePayment });
}
export function useAdminLogin() {
  return useMutation({ mutationFn: loginAdmin });
}
export function useAdminLogout() {
  return useMutation({ mutationFn: logoutAdmin });
}

export function usePaymentVerification(reference: string) {
  return useQuery({
    queryKey: ["payments", "verification", reference],
    enabled: validReference(reference),
    queryFn: async ({ signal }) => {
      const data = await verifyPayment(reference, signal);
      if (
        data.payment.status !== "SUCCESSFUL" ||
        data.purchase.status !== "COMPLETED" ||
        !data.accessCode
      ) {
        throw new Error("Payment is not confirmed yet.");
      }
      return data;
    },
    // Verification may reconcile payment. Repeat only when the customer requests it.
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
