import { describe, it, expect } from "vitest";
import { partnerMetadataSchema, isPartner } from "@/lib/portal/types";

describe("partnerMetadataSchema — workflowProfile", () => {
  const base = { role: "partner", zohoContactId: "abc", company: "Acme Optics" };

  it("accepts metadata without workflowProfile (defaults later)", () => {
    expect(partnerMetadataSchema.safeParse(base).success).toBe(true);
  });

  it("accepts workflowProfile=cash", () => {
    const result = partnerMetadataSchema.safeParse({ ...base, workflowProfile: "cash" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workflowProfile).toBe("cash");
  });

  it("accepts workflowProfile=net30", () => {
    const result = partnerMetadataSchema.safeParse({ ...base, workflowProfile: "net30" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workflowProfile).toBe("net30");
  });

  it("rejects unknown workflowProfile values", () => {
    expect(
      partnerMetadataSchema.safeParse({ ...base, workflowProfile: "consignment" }).success,
    ).toBe(false);
  });

  it("isPartner still passes for valid base + workflowProfile combo", () => {
    expect(isPartner({ ...base, workflowProfile: "net30" })).toBe(true);
  });
});
