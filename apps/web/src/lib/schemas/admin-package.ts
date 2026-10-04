import { z } from "zod";
export const packageFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a package name.").max(120),
  type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  price: z
    .string()
    .regex(
      /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/,
      "Enter a price with at most two decimal places.",
    )
    .refine((v) => /[1-9]/.test(v), "Price must be positive."),
  description: z.string().max(2000, "Use at most 2,000 characters."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export const adminPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  featured: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const recentPurchaseSchema = z.object({
  reference: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
  createdAt: z.string(),
  customer: z.object({ phone: z.string() }),
  package: z.object({ name: z.string() }),
});
export type PackageFormValues = z.infer<typeof packageFormSchema>;
export type AdminPackage = z.infer<typeof adminPackageSchema>;
