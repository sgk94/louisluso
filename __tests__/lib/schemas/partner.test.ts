import { describe, it, expect } from "vitest";
import { partnerSchema } from "@/lib/schemas/partner";

describe("partnerSchema", () => {
  const validData = {
    company: "Test Optical", contactName: "John Doe", email: "john@example.com",
    phone: "555-1234", address: "123 Main St", city: "Chicago", state: "IL",
    zip: "60601", referralSource: "Friend", referralOther: "",
  };

  it("validates complete partner application", () => {
    expect(partnerSchema.safeParse(validData).success).toBe(true);
  });

  it("rejects missing company", () => {
    expect(partnerSchema.safeParse({ ...validData, company: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(partnerSchema.safeParse({ ...validData, email: "bad" }).success).toBe(false);
  });

  it("rejects invalid referral source", () => {
    expect(partnerSchema.safeParse({ ...validData, referralSource: "Invalid" }).success).toBe(false);
  });

  it("requires referralOther when source is Other", () => {
    expect(partnerSchema.safeParse({ ...validData, referralSource: "Other", referralOther: "" }).success).toBe(false);
  });

  it("allows referralOther when source is Other and filled", () => {
    expect(partnerSchema.safeParse({ ...validData, referralSource: "Other", referralOther: "Trade show" }).success).toBe(true);
  });
});
