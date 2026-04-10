import { z } from "zod";

export const contactDealerSchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100),
  customerEmail: z.string().email("Valid email required"),
  message: z.string().max(1000, "Message must be under 1000 characters").optional(),
  productSlug: z.string().max(100).optional(),
});

export type ContactDealerFormData = z.infer<typeof contactDealerSchema>;
