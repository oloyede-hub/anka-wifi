import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(128, "Password is too long."),
});
export const adminIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export const adminLoginResponseSchema = z.object({
  accessToken: z
    .string()
    .max(4096)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().min(300).max(86400),
  admin: adminIdentitySchema,
});
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
export type AdminIdentity = z.infer<typeof adminIdentitySchema>;
