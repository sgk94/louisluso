import { describe, it, expect } from "vitest";
import { quoteSchema } from "@/lib/schemas/quote";

describe("quoteSchema", () => {
  it("validates a complete quote", () => {
    const result = quoteSchema.safeParse({
      items: [
        { itemId: "item-1", quantity: 5, price: 76 },
        { itemId: "item-2", quantity: 10, price: 76 },
      ],
      notes: "Please ship ASAP",
    });
    expect(result.success).toBe(true);
  });

  it("validates without optional notes", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item-1", quantity: 5, price: 76 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = quoteSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item-1", quantity: 0, price: 76 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item-1", quantity: 5, price: -10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = quoteSchema.safeParse({
      items: [{ quantity: 5, price: 76 }],
    });
    expect(result.success).toBe(false);
  });
});
