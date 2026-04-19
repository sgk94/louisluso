import { z } from "zod";

export const quoteFallbackSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  company: z.string().min(1),
  phone: z.string().optional(),
  products: z.string().min(1),
  notes: z.string().optional(),
});

export type QuoteFallbackInput = z.infer<typeof quoteFallbackSchema>;
