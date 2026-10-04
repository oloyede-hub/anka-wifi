import { paymentReferenceSchema } from "./schemas/customer";
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
  payment: { reference: string; status: string };
  purchase: { reference: string; status: string; package: string };
  accessCode: string;
}
export class ApiError extends Error {
  constructor(public status: number) {
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
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export const getPackages = (signal?: AbortSignal) =>
  request<WifiPackage[]>("packages", undefined, signal);
export const createPurchase = (body: {
  packageId: string;
  phone: string;
  email: string;
}) => request<{ reference: string }>("purchases", body);
export const initializePayment = (purchaseReference: string) =>
  request<{
    purchaseReference: string;
    paymentReference: string;
    authorizationUrl: string;
  }>("payments/initialize", { purchaseReference });
export const verifyPayment = (reference: string, signal?: AbortSignal) =>
  request<VerifiedPayment>(
    `payments/verify/${encodeURIComponent(reference)}`,
    undefined,
    signal,
  );
export const validReference = (value: string) =>
  value === value.trim() && paymentReferenceSchema.safeParse(value).success;
