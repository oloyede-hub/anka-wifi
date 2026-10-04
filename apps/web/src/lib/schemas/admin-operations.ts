import { z } from "zod";
import { adminPackageSchema, recentPurchaseSchema } from "./admin-package";
export const codeStatus = z.enum(["AVAILABLE", "RESERVED", "SOLD", "DISABLED"]);
export const purchaseStatus = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export const paymentStatus = z.enum([
  "PENDING",
  "SUCCESSFUL",
  "FAILED",
  "REFUNDED",
]);
const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const code = z
  .string()
  .regex(/^\S{8}$/, "Use exactly 8 characters without spaces.");
const packageId = z.string().min(1, "Choose a package.").max(64);
export const addCodeSchema = z.object({ packageId, code });
export const bulkCodesSchema = z.object({
  packageId,
  codes: z.array(code).min(1).max(1000),
});
export const bulkCodeFormSchema = z.object({
  packageId,
  text: z
    .string()
    .min(1, "Enter codes, one per line.")
    .superRefine((text, ctx) => {
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      if (!lines.length || lines.length > 1000)
        ctx.addIssue({
          code: "custom",
          message: "Enter between 1 and 1,000 codes.",
        });
      const invalid = lines.findIndex((line) => !code.safeParse(line).success);
      if (invalid !== -1)
        ctx.addIssue({
          code: "custom",
          message: `Code ${invalid + 1} must contain exactly 8 characters without spaces.`,
        });
    }),
});
export const bulkResultSchema = z.object({
  requested: z.number().int(),
  created: z.number().int(),
  skipped: z.number().int(),
  duplicatesInRequest: z.number().int(),
  alreadyStored: z.number().int(),
});
export const accessCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: codeStatus,
  packageId: z.string(),
  reservedAt: z.string().nullable(),
  reservationExpiresAt: z.string().nullable(),
  soldAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const accessCodeListSchema = accessCodeSchema.extend({
  package: adminPackageSchema,
});
export const paymentAttemptSchema = z.object({
  reference: z.string(),
  status: paymentStatus,
  provider: z.enum(["PAYSTACK", "FLUTTERWAVE", "MANUAL"]),
  amount: money,
  currency: z.string(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});
export const adminPurchaseSchema = recentPurchaseSchema.extend({
  id: z.string(),
  packageId: z.string(),
  completedAt: z.string().nullable(),
  customer: z.object({ id: z.string(), phone: z.string(), email: z.string() }),
  package: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  }),
  accessCode: z
    .object({
      id: z.string(),
      code: z.string(),
      status: codeStatus,
      soldAt: z.string().nullable(),
    })
    .nullable(),
  payment: z.array(paymentAttemptSchema),
});
export const adminPaymentSchema = paymentAttemptSchema.extend({
  purchase: z.object({
    reference: z.string(),
    status: purchaseStatus,
    packageId: z.string(),
  }),
});
export type AccessCode = z.infer<typeof accessCodeListSchema>;
export type AdminPurchase = z.infer<typeof adminPurchaseSchema>;
export type AdminPayment = z.infer<typeof adminPaymentSchema>;
