// __tests__/lib/catalog/collections.test.ts
import { describe, it, expect } from "vitest";
import {
  getCollectionBySlug,
  matchCollection,
  getCollectionsByCategory,
  COLLECTIONS,
} from "@/lib/catalog/collections";
import type { ZohoItemGroup } from "@/lib/zoho/inventory";

function makeGroup(
  overrides: Partial<ZohoItemGroup> & { group_name: string; brand?: string },
): ZohoItemGroup {
  return {
    group_id: "test-id",
    group_name: overrides.group_name,
    brand: overrides.brand ?? "",
    items: overrides.items ?? [],
    category_name: "",
    description: "",
    image_name: "",
  };
}

describe("getCollectionBySlug", () => {
  it("returns collection for valid slug", () => {
    const c = getCollectionBySlug("signature-series");
    expect(c).toBeDefined();
    expect(c?.name).toBe("Signature Series");
  });

  it("returns undefined for invalid slug", () => {
    expect(getCollectionBySlug("nonexistent")).toBeUndefined();
  });

  it("excludes discontinued collections", () => {
    expect(getCollectionBySlug("clrotte")).toBeUndefined();
  });
});

describe("getCollectionsByCategory", () => {
  it("returns only eyeglasses collections", () => {
    const cols = getCollectionsByCategory("eyeglasses");
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.every((c) => c.category === "eyeglasses")).toBe(true);
  });

  it("returns sunglasses collections", () => {
    const cols = getCollectionsByCategory("sunglasses");
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.every((c) => c.category === "sunglasses")).toBe(true);
  });

  it("does not include discontinued collections", () => {
    const all = [
      ...getCollectionsByCategory("eyeglasses"),
      ...getCollectionsByCategory("sunglasses"),
      ...getCollectionsByCategory("accessories"),
    ];
    expect(all.find((c) => c.slug === "clrotte")).toBeUndefined();
    expect(all.find((c) => c.slug === "veritas-series")).toBeUndefined();
  });

  it("returns collections sorted by sortOrder", () => {
    const cols = getCollectionsByCategory("eyeglasses");
    for (let i = 1; i < cols.length; i++) {
      expect(cols[i].sortOrder).toBeGreaterThanOrEqual(cols[i - 1].sortOrder);
    }
  });
});

describe("matchCollection", () => {
  it("matches LOUISLUSO SG- prefix to Signature Series", () => {
    const group = makeGroup({ group_name: "SG-1011", brand: "LOUISLUSO" });
    expect(matchCollection(group)?.slug).toBe("signature-series");
  });

  it("matches LOUISLUSO LC- prefix to London Collection", () => {
    const group = makeGroup({ group_name: "LC-9018", brand: "LOUISLUSO" });
    expect(matchCollection(group)?.slug).toBe("london-collection");
  });

  it("matches LOUISLUSO LL(T)- prefix to Louisluso Titanium", () => {
    const group = makeGroup({ group_name: "LL(T)-5001", brand: "LOUISLUSO" });
    expect(matchCollection(group)?.slug).toBe("louisluso-titanium");
  });

  it("matches LOUISLUSO LL- prefix to Classic", () => {
    const group = makeGroup({ group_name: "LL-1019", brand: "LOUISLUSO" });
    expect(matchCollection(group)?.slug).toBe("classic");
  });

  it("matches TANDY TA(T)- to Tandy Titanium", () => {
    const group = makeGroup({ group_name: "TA(T)-1144", brand: "TANDY" });
    expect(matchCollection(group)?.slug).toBe("tandy-titanium");
  });

  it("matches TANDY TA- (non-titanium) to Tandy Series", () => {
    const group = makeGroup({ group_name: "TA-7526", brand: "TANDY" });
    expect(matchCollection(group)?.slug).toBe("tandy-series");
  });

  it("matches MANOMOS sunglasses by SKU text", () => {
    const group = makeGroup({
      group_name: "LEON",
      brand: "MANOMOS",
      items: [
        {
          item_id: "1",
          name: "LEON C1",
          sku: "MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass",
          rate: 100,
          stock_on_hand: 0,
          status: "active",
        },
      ],
    });
    expect(matchCollection(group)?.slug).toBe("manomos-sunglasses");
  });

  it("matches MANOMOS glasses (no Sunglass in SKU)", () => {
    const group = makeGroup({
      group_name: "LIVERPOOL",
      brand: "MANOMOS",
      items: [
        {
          item_id: "1",
          name: "LIVERPOOL C1",
          sku: "MANOMOS LIVERPOOL 50/20/145 C1. BLACK",
          rate: 100,
          stock_on_hand: 0,
          status: "active",
        },
      ],
    });
    expect(matchCollection(group)?.slug).toBe("manomos-glasses");
  });

  it("returns null for excluded brands (CLROTTE)", () => {
    const group = makeGroup({ group_name: "BB-MELT 213", brand: "CLROTTE" });
    expect(matchCollection(group)).toBeNull();
  });

  it("returns null for POP UP STORE items", () => {
    const group = makeGroup({
      group_name: "*POP UP STORE-SPOCOM",
      brand: "",
    });
    expect(matchCollection(group)).toBeNull();
  });

  it("returns null for unrecognized products", () => {
    const group = makeGroup({ group_name: "UNKNOWN-999", brand: "UNKNOWN" });
    expect(matchCollection(group)).toBeNull();
  });

  it("matches TANI brand", () => {
    const group = makeGroup({ group_name: "T-7247", brand: "TANI" });
    expect(matchCollection(group)?.slug).toBe("tani");
  });

  it("matches LOUISLUSO JN- prefix to Junior Series", () => {
    const group = makeGroup({ group_name: "JN-001", brand: "LOUISLUSO" });
    expect(matchCollection(group)?.slug).toBe("junior-series");
  });
});
