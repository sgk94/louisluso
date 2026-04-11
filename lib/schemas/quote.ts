import { z } from "zod";

export const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
      }),
    )
    .min(1, "Quote must have at least one item"),
  notes: z.string().max(1000).optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
