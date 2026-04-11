import { describe, it, expect } from "vitest";
import { partnerMetadataSchema } from "@/lib/portal/types";

describe("partnerMetadataSchema", () => {
  it("validates complete partner metadata", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
      company: "Brilliant Eye Care",
      pricingPlanId: "67890",
    });
    expect(result.success).toBe(true);
  });

  it("validates without optional pricingPlanId", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
      company: "Brilliant Eye Care",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-partner role", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "admin",
      zohoContactId: "12345",
      company: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing zohoContactId", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      company: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing company", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
    });
    expect(result.success).toBe(false);
  });
});
