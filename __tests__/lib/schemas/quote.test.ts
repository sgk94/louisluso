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

  it("rejects quantity above 10000", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item-1", quantity: 10001, price: 76 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts quantity exactly at 10000", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item-1", quantity: 10000, price: 76 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects items array longer than 200", () => {
    const result = quoteSchema.safeParse({
      items: Array.from({ length: 201 }, (_, i) => ({
        itemId: `item-${i}`,
        quantity: 1,
        price: 76,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("accepts items array exactly at 200", () => {
    const result = quoteSchema.safeParse({
      items: Array.from({ length: 200 }, (_, i) => ({
        itemId: `item-${i}`,
        quantity: 1,
        price: 76,
      })),
    });
    expect(result.success).toBe(true);
  });

  it("rejects itemId with invalid characters", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item 1!", quantity: 1, price: 76 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects itemId that is too long", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "a".repeat(51), quantity: 1, price: 76 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts itemId with alphanumeric, hyphens, and underscores", () => {
    const result = quoteSchema.safeParse({
      items: [{ itemId: "item_123-ABC", quantity: 1, price: 76 }],
    });
    expect(result.success).toBe(true);
  });
});
