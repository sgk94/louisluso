import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().default(""),
  subject: z.enum(["General Inquiry", "Product Question", "Partnership", "Other"], { message: "Please select a subject" }),
  message: z.string().min(1, "Message is required"),
});

export type ContactFormData = z.infer<typeof contactSchema>;
