import { z } from "zod";

const singleLine = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]+$/, "must be a single line");

export const quoteFallbackSchema = z.object({
  email: z.string().email().max(254),
  name: singleLine(200),
  company: singleLine(200),
  phone: z
    .string()
    .max(50)
    .regex(/^[^\r\n]*$/, "must be a single line")
    .optional(),
  products: z.string().min(1).max(5000),
  notes: z.string().max(2000).optional(),
});

export type QuoteFallbackInput = z.infer<typeof quoteFallbackSchema>;
