import { z } from "zod";

export const checkoutSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(25, "Phone number is too long.")
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(
      z
        .string()
        .regex(
          /^\+?\d{7,15}$/,
          "Enter 7 to 15 digits, optionally starting with +.",
        ),
    ),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
});

export const paymentReferenceSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9.=-]{1,128}$/,
    "Enter a valid payment reference (up to 128 characters).",
  );
export const paymentRecoverySchema = z.object({
  reference: paymentReferenceSchema,
});
export type CheckoutValues = z.infer<typeof checkoutSchema>;
export type PaymentRecoveryValues = z.infer<typeof paymentRecoverySchema>;
