import { describe, it, expect } from "vitest";
import { contactDealerSchema } from "@/lib/schemas/contact-dealer";

describe("contactDealerSchema", () => {
  it("validates a complete contact form", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John Smith",
      customerEmail: "john@example.com",
      message: "I'm interested in trying on the SP1018.",
      productSlug: "sp1018",
    });
    expect(result.success).toBe(true);
  });

  it("validates without optional fields", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing customerName", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "",
      customerEmail: "john@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message over 1000 characters", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      message: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts message at exactly 1000 characters", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      message: "a".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects productSlug with path traversal characters", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      productSlug: "../../../admin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid productSlug with hyphens and spaces", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      productSlug: "let it be",
    });
    expect(result.success).toBe(true);
  });
});
