import { z } from "zod";

export const partnerSchema = z
  .object({
    company: z.string().min(1, "Company name is required"),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Valid email required"),
    phone: z.string().min(1, "Phone is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zip: z.string().min(1, "Zip code is required"),
    referralSource: z.enum(["Friend", "Advertisement", "Social Media", "Other"], {
      message: "Please select how you heard about us",
    }),
    referralOther: z.string().optional().default(""),
  })
  .refine(
    (data) => data.referralSource !== "Other" || data.referralOther.length > 0,
    { message: "Please specify how you heard about us", path: ["referralOther"] },
  );

export type PartnerFormData = z.infer<typeof partnerSchema>;
