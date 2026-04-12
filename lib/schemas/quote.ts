import { z } from "zod";

export const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
        quantity: z.number().int().min(1).max(10000),
        price: z.number().min(0),
      }),
    )
    .min(1, "Quote must have at least one item")
    .max(200, "Quote cannot exceed 200 line items"),
  notes: z.string().max(1000).optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
