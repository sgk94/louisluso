import { z } from "zod";

export const partnerMetadataSchema = z.object({
  role: z.literal("partner"),
  zohoContactId: z.string().min(1),
  company: z.string().min(1),
  pricingPlanId: z.string().optional(),
});

export type PartnerMetadata = z.infer<typeof partnerMetadataSchema>;

export function isPartner(metadata: unknown): metadata is PartnerMetadata {
  return partnerMetadataSchema.safeParse(metadata).success;
}
