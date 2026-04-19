import { describe, it, expect } from "vitest";
import { quoteFallbackSchema } from "@/lib/schemas/quote-fallback";

describe("quoteFallbackSchema", () => {
  const valid = {
    email: "p@acme.com",
    name: "Alice",
    company: "Acme Optics",
    products: "SP1018 in C2 × 5",
  };

  it("accepts a minimal valid payload", () => {
    expect(quoteFallbackSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional phone + notes", () => {
    expect(
      quoteFallbackSchema.safeParse({ ...valid, phone: "555-1212", notes: "asap" }).success,
    ).toBe(true);
  });

  it("rejects bad email", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects empty company", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, company: "" }).success).toBe(false);
  });

  it("rejects empty product list", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, products: "" }).success).toBe(false);
  });

  it("rejects CRLF in company (header injection guard)", () => {
    expect(
      quoteFallbackSchema.safeParse({
        ...valid,
        company: "Acme\r\nBcc: attacker@example.com",
      }).success,
    ).toBe(false);
  });

  it("rejects CRLF in name and phone (header injection guard)", () => {
    expect(
      quoteFallbackSchema.safeParse({ ...valid, name: "Alice\nX-Evil: 1" }).success,
    ).toBe(false);
    expect(
      quoteFallbackSchema.safeParse({ ...valid, phone: "555\r\nX-Evil: 1" }).success,
    ).toBe(false);
  });

  it("rejects products/notes exceeding length caps", () => {
    expect(
      quoteFallbackSchema.safeParse({ ...valid, products: "x".repeat(5001) }).success,
    ).toBe(false);
    expect(
      quoteFallbackSchema.safeParse({ ...valid, notes: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});
