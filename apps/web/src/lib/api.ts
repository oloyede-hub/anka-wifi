import { paymentReferenceSchema } from "./schemas/customer";
import { z } from "zod";
export type CheckoutProvider = "PAYSTACK" | "OPAY";
const checkoutResponseSchema = z.object({
  purchaseReference: paymentReferenceSchema,
  paymentReference: paymentReferenceSchema,
  provider: z.enum(["PAYSTACK", "OPAY"]),
  authorizationUrl: z.url(),
});
export interface WifiPackage {
  id: string;
  name: string;
  description: string | null;
  type: "DAILY" | "WEEKLY" | "MONTHLY";
  price: string;
  status: "ACTIVE" | "INACTIVE";
  featured: boolean;
}
export interface VerifiedPayment {
  payment: { reference: string; status: string; provider: CheckoutProvider };
  purchase: { reference: string; status: string; package: string };
  accessCode: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public paymentReference?: string,
    public paymentState?: "PENDING" | "FAILED",
  ) {
    super("We couldn’t complete this request. Please try again.");
  }
}
async function request<T>(
  path: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/customer/${path}`, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail: unknown = await response.json().catch(() => null);
    const parsed = z
      .object({
        paymentReference: paymentReferenceSchema.optional(),
        paymentState: z.enum(["PENDING", "FAILED"]).optional(),
      })
      .safeParse(detail);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.paymentReference : undefined,
      parsed.success ? parsed.data.paymentState : undefined,
    );
  }
  return response.json() as Promise<T>;
}
export const getPackages = (signal?: AbortSignal) =>
  request<WifiPackage[]>("packages", undefined, signal);
export const createPurchase = (body: {
  packageId: string;
  phone: string;
  email: string;
}) => request<{ reference: string }>("purchases", body);
export const initializePayment = async (input: {
  purchaseReference: string;
  provider: CheckoutProvider;
}) =>
  checkoutResponseSchema.parse(
    await request<unknown>("payments/initialize", input),
  );
export const verifyPayment = (reference: string, signal?: AbortSignal) =>
  request<VerifiedPayment>(
    `payments/verify/${encodeURIComponent(reference)}`,
    undefined,
    signal,
  );
export const validReference = (value: string) =>
  value === value.trim() && paymentReferenceSchema.safeParse(value).success;
