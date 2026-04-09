// __tests__/lib/catalog/catalog.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetItemGroups, mockGetPriceBooks, mockGetPriceBook } = vi.hoisted(
  () => ({
    mockGetItemGroups: vi.fn(),
    mockGetPriceBooks: vi.fn(),
    mockGetPriceBook: vi.fn(),
  }),
);

vi.mock("@/lib/zoho/inventory", () => ({
  getItemGroups: mockGetItemGroups,
  getPriceBooks: mockGetPriceBooks,
  getPriceBook: mockGetPriceBook,
}));

import {
  getCollectionProducts,
  getProductBySlug,
} from "@/lib/catalog/catalog";

const SRP26_ID = "srp26-id";

function makeSrpPriceBooks() {
  mockGetPriceBooks.mockResolvedValue([
    { pricebook_id: SRP26_ID, name: "SRP26", pricebook_type: "per_item", status: "active" },
  ]);
  mockGetPriceBook.mockResolvedValue({
    pricebook_id: SRP26_ID,
    name: "SRP26",
    pricebook_type: "per_item",
    status: "active",
    pricebook_items: [
      { pricebook_item_id: "pi1", item_id: "item-1", name: "SG-1011/1", pricebook_rate: 227 },
      { pricebook_item_id: "pi2", item_id: "item-2", name: "SG-1011/2", pricebook_rate: 227 },
    ],
  });
}

function makeItemGroups() {
  mockGetItemGroups.mockResolvedValue([
    {
      group_id: "g1",
      group_name: "SG-1011",
      brand: "LOUISLUSO",
      category_name: "",
      description: "",
      image_name: "",
      items: [
        {
          item_id: "item-1",
          name: "SG-1011/1",
          sku: "SIGNATURE 56/17/140  CO.1  BLACK GLOSSED",
          rate: 76,
          stock_on_hand: 23,
          status: "active",
        },
        {
          item_id: "item-2",
          name: "SG-1011/2",
          sku: "SIGNATURE 56/17/140  CO.2  BLACK MATTE",
          rate: 76,
          stock_on_hand: 0,
          status: "active",
        },
      ],
    },
    {
      group_id: "g2",
      group_name: "LL-1019",
      brand: "LOUISLUSO",
      category_name: "",
      description: "",
      image_name: "",
      items: [
        {
          item_id: "item-3",
          name: "LL-1019/1",
          sku: "CLASSIC 52/18/135  CO.1  BLACK",
          rate: 65,
          stock_on_hand: 10,
          status: "active",
        },
      ],
    },
    {
      group_id: "g-excluded",
      group_name: "BB-MELT 213",
      brand: "CLROTTE",
      category_name: "",
      description: "",
      image_name: "",
      items: [],
    },
  ]);
}

describe("getCollectionProducts", () => {
  beforeEach(() => {
    mockGetItemGroups.mockReset();
    mockGetPriceBooks.mockReset();
    mockGetPriceBook.mockReset();
  });

  it("returns products for a valid collection slug", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getCollectionProducts("signature-series");

    expect(result).not.toBeNull();
    expect(result!.collection.slug).toBe("signature-series");
    expect(result!.products).toHaveLength(1);
    expect(result!.products[0].name).toBe("SG-1011");
    expect(result!.products[0].srp).toBe(227);
  });

  it("parses color variants correctly", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getCollectionProducts("signature-series");
    const variants = result!.products[0].variants;

    expect(variants).toHaveLength(2);
    expect(variants[0].colorCode).toBe("C1");
    expect(variants[0].colorName).toBe("Black Glossed");
    expect(variants[0].inStock).toBe(true);
    expect(variants[1].colorCode).toBe("C2");
    expect(variants[1].colorName).toBe("Black Matte");
    expect(variants[1].inStock).toBe(false);
  });

  it("parses dimensions from first variant SKU", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getCollectionProducts("signature-series");

    expect(result!.products[0].dimensions).toEqual({
      lens: 56,
      bridge: 17,
      temple: 140,
    });
  });

  it("excludes products from other collections", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getCollectionProducts("signature-series");

    expect(result!.products.every((p) => p.name.startsWith("SG-"))).toBe(true);
  });

  it("returns null for invalid collection slug", async () => {
    const result = await getCollectionProducts("nonexistent");
    expect(result).toBeNull();
  });

  it("uses fallback SRP when price book entry missing", async () => {
    makeItemGroups();
    mockGetPriceBooks.mockResolvedValue([
      { pricebook_id: SRP26_ID, name: "SRP26", pricebook_type: "per_item", status: "active" },
    ]);
    mockGetPriceBook.mockResolvedValue({
      pricebook_id: SRP26_ID,
      name: "SRP26",
      pricebook_items: [],
    });

    const result = await getCollectionProducts("signature-series");

    expect(result!.products[0].srp).toBe(227); // fallbackSrp from collection config
  });

  it("excludes discontinued brands", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const eyeglasses = await getCollectionProducts("signature-series");
    expect(
      eyeglasses!.products.find((p) => p.name === "BB-MELT 213"),
    ).toBeUndefined();
  });
});

describe("getProductBySlug", () => {
  beforeEach(() => {
    mockGetItemGroups.mockReset();
    mockGetPriceBooks.mockReset();
    mockGetPriceBook.mockReset();
  });

  it("returns a single product with collection info", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getProductBySlug("sg-1011");

    expect(result).not.toBeNull();
    expect(result!.product.name).toBe("SG-1011");
    expect(result!.product.srp).toBe(227);
    expect(result!.collection.slug).toBe("signature-series");
    expect(result!.collection.material).toBe("ULTEM");
  });

  it("returns null for unknown product slug", async () => {
    makeItemGroups();
    makeSrpPriceBooks();

    const result = await getProductBySlug("zz-9999");
    expect(result).toBeNull();
  });
});
