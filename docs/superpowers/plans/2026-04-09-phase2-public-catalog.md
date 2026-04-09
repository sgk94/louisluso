# Phase 2: Public Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing product catalog — category pages, collection grids, and product detail pages — pulling product data from Zoho Inventory and SRP pricing from a dedicated SRP26 price book.

**Architecture:** Static collection config maps Zoho item groups to website collections by SKU prefix and brand. API routes fetch item groups + SRP prices from Zoho, merge them, and serve to ISR-cached React Server Component pages. SKU text is parsed for color names and frame dimensions.

**Tech Stack:** Next.js 16 (App Router, TypeScript strict), Zoho Inventory API, Tailwind CSS, Vitest

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `lib/catalog/collections.ts` | Static collection config array + lookup/match helpers |
| `lib/catalog/sku-parser.ts` | Parse color code/name and dimensions from Zoho SKU text |
| `lib/catalog/catalog.ts` | Fetch item groups + SRP prices, merge, filter, map to collections |
| `lib/catalog/types.ts` | Shared types for catalog data (CatalogProduct, CatalogVariant, etc.) |
| `lib/catalog/images.ts` | Image URL helper (placeholder now, Cloudinary later) |
| `app/eyeglasses/page.tsx` | Eyeglasses category page — grid of collection cards |
| `app/eyeglasses/[collection]/page.tsx` | Collection product grid with ISR |
| `app/sunglasses/page.tsx` | Sunglasses category page |
| `app/sunglasses/[collection]/page.tsx` | Collection product grid with ISR |
| `app/accessories/page.tsx` | Accessories listing page |
| `app/products/[slug]/page.tsx` | Product detail page with variants |
| `scripts/setup-srp26.ts` | One-time script: backup rates, update list prices, create SRP26 price book |
| `scripts/data/` | Directory for backup JSON output |
| `__tests__/lib/catalog/sku-parser.test.ts` | SKU parser unit tests |
| `__tests__/lib/catalog/collections.test.ts` | Collection matching unit tests |
| `__tests__/lib/catalog/catalog.test.ts` | Catalog data layer integration tests |

### Modified files

| File | Changes |
|---|---|
| `lib/zoho/inventory.ts` | Fix pricebooks endpoint path, add `getPriceBook` / `getPriceBooks` functions |
| `__tests__/lib/zoho/inventory.test.ts` | Update tests for renamed pricebooks functions |

---

## Task 1: SKU Parsers

Pure utility functions with no dependencies. TDD first.

**Files:**
- Create: `lib/catalog/sku-parser.ts`
- Test: `__tests__/lib/catalog/sku-parser.test.ts`

- [ ] **Step 1: Write failing tests for color parser**

```ts
// __tests__/lib/catalog/sku-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseColor, parseDimensions } from "@/lib/catalog/sku-parser";

describe("parseColor", () => {
  it("parses CO.{number} format", () => {
    expect(parseColor("SIGNATURE 56/17/140  CO.1  BLACK GLOSSED")).toEqual({
      colorCode: "C1",
      colorName: "Black Glossed",
    });
  });

  it("parses CO.{number} with multi-word color", () => {
    expect(parseColor("SIGNATURE 56/17/140  CO.24  GRAY GLOSSED")).toEqual({
      colorCode: "C24",
      colorName: "Gray Glossed",
    });
  });

  it("parses C{number}. format (Manomos)", () => {
    expect(
      parseColor("MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass"),
    ).toEqual({
      colorCode: "C1",
      colorName: "Gold Green",
    });
  });

  it("strips 'Sunglass' suffix from color name", () => {
    expect(
      parseColor("MANOMOS ABBEY 52/22/145 C2. BROWN/GOLD Sunglass"),
    ).toEqual({
      colorCode: "C2",
      colorName: "Brown/Gold",
    });
  });

  it("parses CO. format with slash in color name", () => {
    expect(
      parseColor("LL(T)-5001/1 LOUISLUSO TITANIUM(T) 50/19/140 CO.1 BLACK/GOLD"),
    ).toEqual({
      colorCode: "C1",
      colorName: "Black/Gold",
    });
  });

  it("returns null for unparseable SKU", () => {
    expect(parseColor("SOME RANDOM TEXT")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseColor("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/catalog/sku-parser.test.ts`
Expected: FAIL — `parseColor` not found

- [ ] **Step 3: Implement color parser**

```ts
// lib/catalog/sku-parser.ts

export interface ParsedColor {
  colorCode: string;
  colorName: string;
}

export interface ParsedDimensions {
  lens: number;
  bridge: number;
  temple: number;
}

export function parseColor(sku: string): ParsedColor | null {
  // Format 1: CO.{number} {COLOR NAME} [Sunglass]
  const coMatch = sku.match(/CO\.(\d+)\s+(.+?)(?:\s+Sunglass)?$/i);
  if (coMatch) {
    return {
      colorCode: `C${coMatch[1]}`,
      colorName: coMatch[2].trim(),
    };
  }

  // Format 2: C{number}. {COLOR NAME} [Sunglass]
  const cMatch = sku.match(/C(\d+)\.\s+(.+?)(?:\s+Sunglass)?$/i);
  if (cMatch) {
    return {
      colorCode: `C${cMatch[1]}`,
      colorName: cMatch[2].trim(),
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/catalog/sku-parser.test.ts`
Expected: All `parseColor` tests PASS

- [ ] **Step 5: Write failing tests for dimension parser**

Add to `__tests__/lib/catalog/sku-parser.test.ts`:

```ts
describe("parseDimensions", () => {
  it("parses standard dimensions from SKU", () => {
    expect(
      parseDimensions("SIGNATURE 56/17/140  CO.1  BLACK GLOSSED"),
    ).toEqual({ lens: 56, bridge: 17, temple: 140 });
  });

  it("parses dimensions from Manomos SKU", () => {
    expect(
      parseDimensions("MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass"),
    ).toEqual({ lens: 54, bridge: 20, temple: 145 });
  });

  it("parses dimensions from Titanium SKU", () => {
    expect(
      parseDimensions(
        "LL(T)-5001/1 LOUISLUSO TITANIUM(T) 50/19/140 CO.1 BLACK/GOLD",
      ),
    ).toEqual({ lens: 50, bridge: 19, temple: 140 });
  });

  it("returns null when no dimensions found", () => {
    expect(parseDimensions("NO DIMENSIONS HERE")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDimensions("")).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify dimension tests fail**

Run: `pnpm test -- __tests__/lib/catalog/sku-parser.test.ts`
Expected: `parseDimensions` tests FAIL

- [ ] **Step 7: Implement dimension parser**

Add to `lib/catalog/sku-parser.ts`:

```ts
export function parseDimensions(sku: string): ParsedDimensions | null {
  const match = sku.match(/(\d{2,3})\/(\d{2,3})\/(\d{2,3})/);
  if (!match) return null;

  return {
    lens: parseInt(match[1], 10),
    bridge: parseInt(match[2], 10),
    temple: parseInt(match[3], 10),
  };
}
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `pnpm test -- __tests__/lib/catalog/sku-parser.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add lib/catalog/sku-parser.ts __tests__/lib/catalog/sku-parser.test.ts
git commit -m "feat: add SKU parsers for color and dimensions"
```

---

## Task 2: Catalog Types

Shared types used by the catalog data layer and UI components.

**Files:**
- Create: `lib/catalog/types.ts`

- [ ] **Step 1: Create types file**

```ts
// lib/catalog/types.ts

export interface CatalogVariant {
  id: string;
  colorCode: string;
  colorName: string;
  inStock: boolean;
  image: string | null;
}

export interface CatalogDimensions {
  lens: number;
  bridge: number;
  temple: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  srp: number | null;
  image: string | null;
  variants: CatalogVariant[];
  dimensions: CatalogDimensions | null;
}

export interface CollectionDetail {
  slug: string;
  name: string;
  category: "eyeglasses" | "sunglasses" | "accessories";
  material: string;
}

export interface CollectionWithProducts {
  collection: CollectionDetail;
  products: CatalogProduct[];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/catalog/types.ts
git commit -m "feat: add catalog type definitions"
```

---

## Task 3: Collection Config & Matching

Static config array mapping collections to Zoho data patterns.

**Files:**
- Create: `lib/catalog/collections.ts`
- Test: `__tests__/lib/catalog/collections.test.ts`

- [ ] **Step 1: Write failing tests for collection matching**

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/catalog/collections.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement collection config and matching**

```ts
// lib/catalog/collections.ts
import type { ZohoItemGroup } from "@/lib/zoho/inventory";

export interface Collection {
  slug: string;
  name: string;
  category: "eyeglasses" | "sunglasses" | "accessories";
  skuPrefix: string;
  brand: string;
  material: string;
  fallbackSrp: number | null;
  sortOrder: number;
  isNew?: boolean;
  isDiscontinued?: boolean;
}

export const COLLECTIONS: Collection[] = [
  // --- Eyeglasses ---
  { slug: "signature-series", name: "Signature Series", category: "eyeglasses", skuPrefix: "SG-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 227, sortOrder: 1 },
  { slug: "signature-plus-series", name: "Signature Plus Series", category: "eyeglasses", skuPrefix: "SP-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 243, sortOrder: 2 },
  { slug: "london-collection", name: "London Collection", category: "eyeglasses", skuPrefix: "LC-", brand: "LOUISLUSO", material: "Titanium", fallbackSrp: 243, sortOrder: 3 },
  { slug: "urban-collection", name: "Urban Collection", category: "eyeglasses", skuPrefix: "LU-", brand: "LOUISLUSO", material: "Titanium", fallbackSrp: 362, sortOrder: 4 },
  { slug: "milan-series", name: "Milan Series", category: "eyeglasses", skuPrefix: "ML-", brand: "LOUISLUSO", material: "Titanium", fallbackSrp: 296, sortOrder: 5 },
  { slug: "classic", name: "Classic", category: "eyeglasses", skuPrefix: "LL-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 195, sortOrder: 6 },
  { slug: "louisluso-titanium", name: "Louisluso Titanium", category: "eyeglasses", skuPrefix: "LL(T)-", brand: "LOUISLUSO", material: "Titanium", fallbackSrp: 267, sortOrder: 7 },
  { slug: "grand-collection", name: "Grand Collection", category: "eyeglasses", skuPrefix: "GC-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 218, sortOrder: 8 },
  { slug: "rimless-air-series", name: "Rimless Air Series", category: "eyeglasses", skuPrefix: "RA-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 203, sortOrder: 9 },
  { slug: "skylite", name: "Skylite", category: "eyeglasses", skuPrefix: "SL-", brand: "LOUISLUSO", material: "ULTEM", fallbackSrp: 36, sortOrder: 10 },
  { slug: "close-out", name: "Close Out", category: "eyeglasses", skuPrefix: "AB-", brand: "LOUISLUSO", material: "Mixed", fallbackSrp: null, sortOrder: 11 },
  { slug: "snf", name: "SNF", category: "eyeglasses", skuPrefix: "SNF-", brand: "SNF", material: "ULTEM", fallbackSrp: 390, sortOrder: 12 },
  { slug: "eyes-cloud-kids", name: "Eye's Cloud Kids", category: "eyeglasses", skuPrefix: "EK-", brand: "EYE CLOUD", material: "ULTEM", fallbackSrp: 170, sortOrder: 13 },
  { slug: "tandy-series", name: "Tandy Series", category: "eyeglasses", skuPrefix: "TA-", brand: "TANDY", material: "ULTEM", fallbackSrp: 253, sortOrder: 14 },
  { slug: "tandy-titanium", name: "Tandy Titanium", category: "eyeglasses", skuPrefix: "TA(T)-", brand: "TANDY", material: "Titanium", fallbackSrp: 324, sortOrder: 15 },
  { slug: "tani", name: "TANI", category: "eyeglasses", skuPrefix: "T-", brand: "TANI", material: "ULTEM", fallbackSrp: null, sortOrder: 16 },
  { slug: "veritas-classic", name: "Veritas Classic", category: "eyeglasses", skuPrefix: "VT-", brand: "VERITAS", material: "ULTEM", fallbackSrp: 154, sortOrder: 17 },
  { slug: "veritas-series", name: "Veritas Series", category: "eyeglasses", skuPrefix: "VT-", brand: "VERITAS", material: "ULTEM", fallbackSrp: 154, sortOrder: 18 },
  { slug: "manomos-glasses", name: "Manomos Glasses (BTS Collection)", category: "eyeglasses", skuPrefix: "", brand: "MANOMOS", material: "Acetate", fallbackSrp: null, sortOrder: 19 },
  // --- Sunglasses ---
  { slug: "manomos-sunglasses", name: "Manomos Sunglasses (BTS Collection)", category: "sunglasses", skuPrefix: "", brand: "MANOMOS", material: "Acetate", fallbackSrp: null, sortOrder: 1 },
  // --- Discontinued (excluded from site) ---
  { slug: "clrotte", name: "CLROTTE", category: "eyeglasses", skuPrefix: "", brand: "CLROTTE", material: "Mixed", fallbackSrp: null, sortOrder: 99, isDiscontinued: true },
];

// Brands to exclude entirely (no collection match)
const EXCLUDED_BRANDS = new Set(["CLROTTE", "AKIO"]);
const EXCLUDED_NAME_PREFIXES = ["*POP UP STORE", "[LXIV]"];

export function getCollectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug && !c.isDiscontinued);
}

export function getCollectionsByCategory(
  category: "eyeglasses" | "sunglasses" | "accessories",
): Collection[] {
  return COLLECTIONS
    .filter((c) => c.category === category && !c.isDiscontinued)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function matchCollection(group: ZohoItemGroup): Collection | null {
  const brand = group.brand ?? "";
  const name = group.group_name;

  // Excluded brands
  if (EXCLUDED_BRANDS.has(brand)) return null;

  // Excluded name patterns
  if (EXCLUDED_NAME_PREFIXES.some((p) => name.startsWith(p))) return null;

  // MANOMOS: distinguish glasses vs sunglasses by SKU text
  if (brand === "MANOMOS") {
    const isSunglass = group.items?.some((item) =>
      item.sku.toLowerCase().includes("sunglass"),
    );
    return isSunglass
      ? getCollectionBySlug("manomos-sunglasses") ?? null
      : getCollectionBySlug("manomos-glasses") ?? null;
  }

  // TANDY: distinguish titanium by (T) in group name
  if (brand === "TANDY") {
    return name.includes("(T)")
      ? getCollectionBySlug("tandy-titanium") ?? null
      : getCollectionBySlug("tandy-series") ?? null;
  }

  // VERITAS: both sub-collections share VT- prefix
  // For now, all go to veritas-classic (Veritas split TBD — needs WooCommerce cross-reference)
  if (brand === "VERITAS") {
    return getCollectionBySlug("veritas-classic") ?? null;
  }

  // SNF, EYE CLOUD: match by brand
  if (brand === "SNF") return getCollectionBySlug("snf") ?? null;
  if (brand === "EYE CLOUD") return getCollectionBySlug("eyes-cloud-kids") ?? null;

  // LOUISLUSO: match by group_name prefix
  // Order matters: LL(T)- must be checked before LL-
  if (brand === "LOUISLUSO") {
    const prefixMap: Array<[string, string]> = [
      ["SG-", "signature-series"],
      ["SP-", "signature-plus-series"],
      ["LC-", "london-collection"],
      ["LU-", "urban-collection"],
      ["ML-", "milan-series"],
      ["GC-", "grand-collection"],
      ["RA-", "rimless-air-series"],
      ["SL-", "skylite"],
      ["AB-", "close-out"],
      ["LL(T)-", "louisluso-titanium"],
      ["LL-", "classic"],
    ];

    for (const [prefix, slug] of prefixMap) {
      if (name.startsWith(prefix)) {
        return getCollectionBySlug(slug) ?? null;
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/catalog/collections.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/collections.ts __tests__/lib/catalog/collections.test.ts
git commit -m "feat: add collection config and matching logic"
```

---

## Task 4: Fix Zoho Price Book API

The existing `lib/zoho/inventory.ts` uses `/inventory/v1/pricelists` — the correct endpoint is `/inventory/v1/pricebooks`. The response shape also differs (field names use `pricebook` not `pricelist`).

**Files:**
- Modify: `lib/zoho/inventory.ts`
- Modify: `__tests__/lib/zoho/inventory.test.ts`

- [ ] **Step 1: Update types and functions in inventory.ts**

In `lib/zoho/inventory.ts`, replace the price list types and functions. Keep the old exports as aliases for backwards compatibility if they're used elsewhere, but the tests showed they're only used in tests.

Replace the `ZohoPriceList` interface, `PriceListsResponse`, `PriceListResponse`, `getPriceLists`, and `getPriceList` with:

```ts
export interface ZohoPriceBook {
  pricebook_id: string;
  name: string;
  pricebook_type: string;
  status: string;
  percentage?: number;
  pricebook_items?: Array<{
    pricebook_item_id: string;
    item_id: string;
    name: string;
    pricebook_rate: number;
  }>;
}

interface PriceBooksResponse {
  pricebooks: ZohoPriceBook[];
  page_context: PageContext;
}

interface PriceBookResponse {
  pricebook: ZohoPriceBook;
}

export async function getPriceBooks(): Promise<ZohoPriceBook[]> {
  const response = await zohoFetch<PriceBooksResponse>(
    "/inventory/v1/pricebooks",
  );
  return response.pricebooks;
}

export async function getPriceBook(
  priceBookId: string,
): Promise<ZohoPriceBook> {
  const parsed = zohoIdSchema.safeParse(priceBookId);
  if (!parsed.success) throw new Error("Invalid price book ID");

  const response = await zohoFetch<PriceBookResponse>(
    `/inventory/v1/pricebooks/${parsed.data}`,
  );
  return response.pricebook;
}
```

Remove the old `ZohoPriceList`, `PriceListsResponse`, `PriceListResponse`, `getPriceLists`, and `getPriceList` exports.

- [ ] **Step 2: Update tests**

In `__tests__/lib/zoho/inventory.test.ts`, replace the `getPriceLists` and `getPriceList` test blocks with:

```ts
  describe("getPriceBooks", () => {
    it("returns price books array", async () => {
      const priceBooks = [
        { pricebook_id: "p1", name: "SRP26", pricebook_type: "per_item", status: "active" },
        { pricebook_id: "p2", name: "20% DISCOUNT", pricebook_type: "per_item", status: "active" },
      ];
      mockZohoFetch.mockResolvedValueOnce({ pricebooks: priceBooks, page_context: { has_more_page: false } });

      const result = await getPriceBooks();

      expect(mockZohoFetch).toHaveBeenCalledWith("/inventory/v1/pricebooks");
      expect(result).toEqual(priceBooks);
      expect(result).toHaveLength(2);
    });
  });

  describe("getPriceBook", () => {
    it("fetches a single price book by ID", async () => {
      const priceBook = {
        pricebook_id: "p1",
        name: "SRP26",
        pricebook_type: "per_item",
        status: "active",
        pricebook_items: [{ pricebook_item_id: "pi1", item_id: "1", name: "SG-1011/1", pricebook_rate: 227 }],
      };
      mockZohoFetch.mockResolvedValueOnce({ pricebook: priceBook });

      const result = await getPriceBook("p1");

      expect(mockZohoFetch).toHaveBeenCalledWith("/inventory/v1/pricebooks/p1");
      expect(result).toEqual(priceBook);
    });
  });
```

Update the import at the top to import `getPriceBooks` and `getPriceBook` instead of `getPriceLists` and `getPriceList`.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/lib/zoho/inventory.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add lib/zoho/inventory.ts __tests__/lib/zoho/inventory.test.ts
git commit -m "fix: use correct Zoho pricebooks API endpoint"
```

---

## Task 5: Image URL Helper

Placeholder function that returns a placeholder image path now and will return Cloudinary URLs later.

**Files:**
- Create: `lib/catalog/images.ts`

- [ ] **Step 1: Create image helper**

```ts
// lib/catalog/images.ts

const PLACEHOLDER_IMAGE = "/images/placeholder-frame.svg";

/**
 * Returns the product image URL.
 * Currently returns a placeholder. When Cloudinary migration is done,
 * this will return: https://res.cloudinary.com/dctwzk6sn/image/upload/products/{sku}/{view}.jpg
 */
export function getProductImageUrl(
  _sku: string | null,
  _view: "main" | "side" | "front" = "main",
): string {
  return PLACEHOLDER_IMAGE;
}
```

- [ ] **Step 2: Create placeholder SVG**

```bash
mkdir -p public/images
```

Create `public/images/placeholder-frame.svg` — a simple frame silhouette placeholder:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" fill="none">
  <rect width="400" height="200" fill="#F5F5F5"/>
  <g transform="translate(80, 60)">
    <rect x="0" y="0" width="100" height="70" rx="20" stroke="#D1D5DB" stroke-width="2" fill="none"/>
    <rect x="140" y="0" width="100" height="70" rx="20" stroke="#D1D5DB" stroke-width="2" fill="none"/>
    <line x1="100" y1="35" x2="140" y2="35" stroke="#D1D5DB" stroke-width="2"/>
  </g>
  <text x="200" y="160" text-anchor="middle" fill="#9CA3AF" font-family="system-ui" font-size="14">LOUISLUSO</text>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add lib/catalog/images.ts public/images/placeholder-frame.svg
git commit -m "feat: add placeholder image helper for catalog"
```

---

## Task 6: Catalog Data Layer

Fetches item groups and SRP prices from Zoho, merges them, maps to collections.

**Files:**
- Create: `lib/catalog/catalog.ts`
- Test: `__tests__/lib/catalog/catalog.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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

    // CLROTTE should not appear in any collection
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/catalog/catalog.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement catalog data layer**

```ts
// lib/catalog/catalog.ts
import { getItemGroups, getPriceBooks, getPriceBook } from "@/lib/zoho/inventory";
import type { ZohoItemGroup } from "@/lib/zoho/inventory";
import { matchCollection, getCollectionBySlug } from "@/lib/catalog/collections";
import type { Collection } from "@/lib/catalog/collections";
import { parseColor, parseDimensions } from "@/lib/catalog/sku-parser";
import { getProductImageUrl } from "@/lib/catalog/images";
import type {
  CatalogProduct,
  CatalogVariant,
  CollectionDetail,
  CollectionWithProducts,
} from "@/lib/catalog/types";

const SRP_PRICE_BOOK_NAME = "SRP26";

interface SrpLookup {
  [itemId: string]: number;
}

async function loadSrpPrices(): Promise<SrpLookup> {
  const priceBooks = await getPriceBooks();
  const srpBook = priceBooks.find((pb) => pb.name === SRP_PRICE_BOOK_NAME);
  if (!srpBook) return {};

  const full = await getPriceBook(srpBook.pricebook_id);
  const lookup: SrpLookup = {};
  for (const item of full.pricebook_items ?? []) {
    lookup[item.item_id] = item.pricebook_rate;
  }
  return lookup;
}

function groupToProduct(
  group: ZohoItemGroup,
  collection: Collection,
  srpLookup: SrpLookup,
): CatalogProduct {
  const firstSku = group.items?.[0]?.sku ?? "";
  const dimensions = parseDimensions(firstSku);

  // Find SRP: check price book first, then fallback
  let srp: number | null = null;
  const firstItemWithSrp = group.items?.find((item) => srpLookup[item.item_id]);
  if (firstItemWithSrp) {
    srp = srpLookup[firstItemWithSrp.item_id];
  } else {
    srp = collection.fallbackSrp;
  }

  const variants: CatalogVariant[] = (group.items ?? []).map((item) => {
    const parsed = parseColor(item.sku);
    return {
      id: item.item_id,
      colorCode: parsed?.colorCode ?? "",
      colorName: parsed?.colorName ?? item.name,
      inStock: item.stock_on_hand > 0,
      image: getProductImageUrl(item.sku),
    };
  });

  return {
    id: group.group_id,
    slug: group.group_name.toLowerCase(),
    name: group.group_name,
    srp,
    image: getProductImageUrl(firstSku),
    variants,
    dimensions,
  };
}

function toCollectionDetail(c: Collection): CollectionDetail {
  return {
    slug: c.slug,
    name: c.name,
    category: c.category,
    material: c.material,
  };
}

export async function getCollectionProducts(
  slug: string,
): Promise<CollectionWithProducts | null> {
  const collection = getCollectionBySlug(slug);
  if (!collection) return null;

  const [groups, srpLookup] = await Promise.all([
    getItemGroups(),
    loadSrpPrices(),
  ]);

  const products: CatalogProduct[] = [];
  for (const group of groups) {
    const matched = matchCollection(group);
    if (matched?.slug === slug) {
      products.push(groupToProduct(group, collection, srpLookup));
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name));

  return {
    collection: toCollectionDetail(collection),
    products,
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<{ product: CatalogProduct; collection: CollectionDetail } | null> {
  const [groups, srpLookup] = await Promise.all([
    getItemGroups(),
    loadSrpPrices(),
  ]);

  for (const group of groups) {
    if (group.group_name.toLowerCase() === slug) {
      const collection = matchCollection(group);
      if (!collection) return null;
      return {
        product: groupToProduct(group, collection, srpLookup),
        collection: toCollectionDetail(collection),
      };
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/catalog/catalog.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All PASS (including existing tests)

- [ ] **Step 6: Commit**

```bash
git add lib/catalog/catalog.ts __tests__/lib/catalog/catalog.test.ts
git commit -m "feat: add catalog data layer with SRP pricing"
```

---

## Task 7: Category Pages (Eyeglasses & Sunglasses)

Server Components that render a grid of collection cards.

**Files:**
- Create: `app/eyeglasses/page.tsx`
- Create: `app/sunglasses/page.tsx`

- [ ] **Step 1: Create eyeglasses category page**

```tsx
// app/eyeglasses/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionsByCategory } from "@/lib/catalog/collections";

export const metadata: Metadata = {
  title: "Eyeglasses — LOUISLUSO",
  description: "Browse our eyeglasses collections. The World's Lightest Frames.",
};

export default function EyeglassesPage(): React.ReactElement {
  const collections = getCollectionsByCategory("eyeglasses");

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-light uppercase tracking-widest">
        Eyeglasses
      </h1>
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={`/eyeglasses/${collection.slug}`}
            className="group block"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <div className="flex h-full items-center justify-center text-gray-400">
                {/* Placeholder — replaced with collection image later */}
                <span className="text-sm uppercase tracking-wide">
                  {collection.name}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide group-hover:underline">
                {collection.name}
              </h2>
              {collection.isNew && (
                <span className="bg-black px-2 py-0.5 text-xs font-medium uppercase text-white">
                  New
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {collection.material}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create sunglasses category page**

```tsx
// app/sunglasses/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionsByCategory } from "@/lib/catalog/collections";

export const metadata: Metadata = {
  title: "Sunglasses — LOUISLUSO",
  description: "Browse our sunglasses collections. The World's Lightest Frames.",
};

export default function SunglassesPage(): React.ReactElement {
  const collections = getCollectionsByCategory("sunglasses");

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-light uppercase tracking-widest">
        Sunglasses
      </h1>
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={`/sunglasses/${collection.slug}`}
            className="group block"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <div className="flex h-full items-center justify-center text-gray-400">
                <span className="text-sm uppercase tracking-wide">
                  {collection.name}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-sm font-medium uppercase tracking-wide group-hover:underline">
                {collection.name}
              </h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {collection.material}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify pages render locally**

Run: `pnpm dev`
Visit: `http://localhost:3000/eyeglasses` and `http://localhost:3000/sunglasses`
Expected: Grid of collection cards renders with placeholder content

- [ ] **Step 4: Commit**

```bash
git add app/eyeglasses/page.tsx app/sunglasses/page.tsx
git commit -m "feat: add eyeglasses and sunglasses category pages"
```

---

## Task 8: Collection Product Grid Pages

Dynamic `[collection]` route that shows a product grid for a specific collection. Uses ISR with 15-min revalidation.

**Files:**
- Create: `app/eyeglasses/[collection]/page.tsx`
- Create: `app/sunglasses/[collection]/page.tsx`
- Create: `app/components/ProductGrid.tsx` (shared between eyeglasses/sunglasses)
- Create: `app/components/ProductCard.tsx`

- [ ] **Step 1: Create ProductCard component**

```tsx
// app/components/ProductCard.tsx
import Link from "next/link";
import Image from "next/image";
import type { CatalogProduct } from "@/lib/catalog/types";

interface ProductCardProps {
  product: CatalogProduct;
}

export function ProductCard({ product }: ProductCardProps): React.ReactElement {
  const allOutOfStock = product.variants.every((v) => !v.inStock);

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        <Image
          src={product.image ?? "/images/placeholder-frame.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        {allOutOfStock && (
          <div className="absolute left-0 top-0 bg-gray-900/80 px-2 py-1 text-xs font-medium uppercase text-white">
            Temporarily Out of Stock
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium uppercase tracking-wide">
          {product.name}
        </h3>
        {product.srp !== null ? (
          <p className="mt-1 text-sm text-gray-600">
            ${product.srp.toFixed(0)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-400">Contact for pricing</p>
        )}
        <div className="mt-2 flex gap-1">
          {product.variants.map((v) => (
            <span
              key={v.id}
              title={v.colorName}
              className="inline-block h-3 w-3 rounded-full border border-gray-300 bg-gray-200"
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create ProductGrid component**

```tsx
// app/components/ProductGrid.tsx
import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: CatalogProduct[];
}

export function ProductGrid({
  products,
}: ProductGridProps): React.ReactElement {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">No products found in this collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create eyeglasses collection page**

```tsx
// app/eyeglasses/[collection]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionProducts } from "@/lib/catalog/catalog";
import { getCollectionBySlug, getCollectionsByCategory } from "@/lib/catalog/collections";
import { ProductGrid } from "@/app/components/ProductGrid";

export const revalidate = 900; // ISR: 15 minutes

interface PageProps {
  params: Promise<{ collection: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { collection: slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) return { title: "Not Found — LOUISLUSO" };

  return {
    title: `${collection.name} — LOUISLUSO`,
    description: `Browse ${collection.name}. ${collection.material} frames by LOUISLUSO.`,
  };
}

export async function generateStaticParams(): Promise<
  Array<{ collection: string }>
> {
  return getCollectionsByCategory("eyeglasses").map((c) => ({
    collection: c.slug,
  }));
}

export default async function EyeglassesCollectionPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { collection: slug } = await params;
  const data = await getCollectionProducts(slug);

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/eyeglasses" className="hover:underline">
          Eyeglasses
        </Link>
        <span className="mx-2">/</span>
        <span>{data.collection.name}</span>
      </nav>

      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-light uppercase tracking-widest">
          {data.collection.name}
        </h1>
        <p className="text-sm text-gray-500">
          {data.products.length} {data.products.length === 1 ? "style" : "styles"}
        </p>
      </div>

      <p className="mb-10 text-sm text-gray-500">
        {data.collection.material} frames
      </p>

      <ProductGrid products={data.products} />
    </main>
  );
}
```

- [ ] **Step 4: Create sunglasses collection page**

```tsx
// app/sunglasses/[collection]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCollectionProducts } from "@/lib/catalog/catalog";
import { getCollectionBySlug, getCollectionsByCategory } from "@/lib/catalog/collections";
import { ProductGrid } from "@/app/components/ProductGrid";

export const revalidate = 900; // ISR: 15 minutes

interface PageProps {
  params: Promise<{ collection: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { collection: slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) return { title: "Not Found — LOUISLUSO" };

  return {
    title: `${collection.name} — LOUISLUSO`,
    description: `Browse ${collection.name}. ${collection.material} sunglasses by LOUISLUSO.`,
  };
}

export async function generateStaticParams(): Promise<
  Array<{ collection: string }>
> {
  return getCollectionsByCategory("sunglasses").map((c) => ({
    collection: c.slug,
  }));
}

export default async function SunglassesCollectionPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { collection: slug } = await params;
  const data = await getCollectionProducts(slug);

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/sunglasses" className="hover:underline">
          Sunglasses
        </Link>
        <span className="mx-2">/</span>
        <span>{data.collection.name}</span>
      </nav>

      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-light uppercase tracking-widest">
          {data.collection.name}
        </h1>
        <p className="text-sm text-gray-500">
          {data.products.length} {data.products.length === 1 ? "style" : "styles"}
        </p>
      </div>

      <p className="mb-10 text-sm text-gray-500">
        {data.collection.material} frames
      </p>

      <ProductGrid products={data.products} />
    </main>
  );
}
```

- [ ] **Step 5: Verify locally**

Run: `pnpm dev`
Visit: `http://localhost:3000/eyeglasses/signature-series`
Expected: Product grid renders with SG- products, placeholder images, SRP prices, color swatches

- [ ] **Step 6: Commit**

```bash
git add app/components/ProductCard.tsx app/components/ProductGrid.tsx app/eyeglasses/[collection]/page.tsx app/sunglasses/[collection]/page.tsx
git commit -m "feat: add collection product grid pages with ISR"
```

---

## Task 9: Product Detail Page

Shows a single product with variant selector, dimensions, material, and SRP.

**Files:**
- Create: `app/products/[slug]/page.tsx`
- Create: `app/products/[slug]/VariantSelector.tsx` (client component for interactivity)

- [ ] **Step 1: Create VariantSelector client component**

```tsx
// app/products/[slug]/VariantSelector.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type { CatalogVariant } from "@/lib/catalog/types";

interface VariantSelectorProps {
  variants: CatalogVariant[];
  productName: string;
}

export function VariantSelector({
  variants,
  productName,
}: VariantSelectorProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = variants[selectedIndex];

  return (
    <div>
      {/* Selected variant image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        <Image
          src={selected?.image ?? "/images/placeholder-frame.svg"}
          alt={`${productName} ${selected?.colorName ?? ""}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-8"
          priority
        />
        {selected && !selected.inStock && (
          <div className="absolute left-0 top-0 bg-gray-900/80 px-3 py-1.5 text-xs font-medium uppercase text-white">
            Temporarily Out of Stock
          </div>
        )}
      </div>

      {/* Color selector */}
      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Color — {selected?.colorName ?? ""}
        </h3>
        <div className="mt-3 flex gap-2">
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              onClick={() => setSelectedIndex(index)}
              title={`${variant.colorName}${variant.inStock ? "" : " (Out of Stock)"}`}
              className={`h-8 w-8 rounded-full border-2 bg-gray-200 transition-all ${
                index === selectedIndex
                  ? "border-black"
                  : "border-transparent hover:border-gray-400"
              } ${!variant.inStock ? "opacity-40" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create product detail page**

```tsx
// app/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/catalog/catalog";
import { VariantSelector } from "./VariantSelector";

export const revalidate = 900; // ISR: 15 minutes

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Not Found — LOUISLUSO" };

  return {
    title: `${data.product.name} — LOUISLUSO`,
    description: `${data.product.name}. ${data.collection.material} frame by LOUISLUSO.`,
  };
}

export default async function ProductDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);

  if (!data) notFound();

  const { product, collection } = data;
  const categoryPath =
    collection.category === "sunglasses" ? "/sunglasses" : "/eyeglasses";

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-gray-500">
        <Link href={categoryPath} className="hover:underline">
          {collection.category === "sunglasses" ? "Sunglasses" : "Eyeglasses"}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`${categoryPath}/${collection.slug}`}
          className="hover:underline"
        >
          {collection.name}
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Left: Image + variant selector */}
        <VariantSelector
          variants={product.variants}
          productName={product.name}
        />

        {/* Right: Product info */}
        <div>
          <h1 className="text-2xl font-light uppercase tracking-widest">
            {product.name}
          </h1>

          {product.srp !== null ? (
            <p className="mt-2 text-xl">${product.srp.toFixed(0)}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Contact for pricing</p>
          )}

          {/* Specs */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Specifications
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Material</dt>
                <dd>{collection.material}</dd>
              </div>
              {product.dimensions && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Lens Width</dt>
                    <dd>{product.dimensions.lens}mm</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Bridge</dt>
                    <dd>{product.dimensions.bridge}mm</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Temple Length</dt>
                    <dd>{product.dimensions.temple}mm</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Available Colors</dt>
                <dd>{product.variants.length}</dd>
              </div>
            </dl>
          </div>

          {/* Find a Dealer CTA */}
          <div className="mt-8">
            <Link
              href="/find-a-dealer"
              className="inline-block w-full border border-black px-8 py-3 text-center text-sm font-medium uppercase tracking-wide transition-colors hover:bg-black hover:text-white"
            >
              Find Nearest Dealer
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify locally**

Run: `pnpm dev`
Visit: `http://localhost:3000/products/sg-1011`
Expected: Product detail page with variant selector, specs, SRP price, and breadcrumb

- [ ] **Step 4: Commit**

```bash
git add app/products/[slug]/page.tsx app/products/[slug]/VariantSelector.tsx
git commit -m "feat: add product detail page with variant selector"
```

---

## Task 10: Accessories Page

Simple listing page. Same ISR pattern as collections.

**Files:**
- Create: `app/accessories/page.tsx`

- [ ] **Step 1: Create accessories page**

```tsx
// app/accessories/page.tsx
import type { Metadata } from "next";

export const revalidate = 900; // ISR: 15 minutes

export const metadata: Metadata = {
  title: "Accessories — LOUISLUSO",
  description: "Browse LOUISLUSO eyewear accessories.",
};

export default function AccessoriesPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-light uppercase tracking-widest">
        Accessories
      </h1>
      <div className="mt-10 py-16 text-center">
        <p className="text-gray-500">Accessories coming soon.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/accessories/page.tsx
git commit -m "feat: add accessories page placeholder"
```

---

## Task 11: SRP26 Setup Script

One-time script to: (1) backup current Zoho rates, (2) update stale list prices, (3) create and populate the SRP26 price book.

**Files:**
- Create: `scripts/setup-srp26.ts`
- Create: `scripts/data/` directory

- [ ] **Step 1: Create the setup script**

```ts
// scripts/setup-srp26.ts
import "dotenv/config";
import { getItemGroups, getPriceBooks } from "../lib/zoho/inventory";
import { getAccessToken } from "../lib/zoho/auth";
import { matchCollection } from "../lib/catalog/collections";
import type { Collection } from "../lib/catalog/collections";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const ZOHO_API_BASE = process.env.ZOHO_API_BASE_URL ?? "https://www.zohoapis.com";
const ORG_ID = process.env.ZOHO_ORG_ID!;

// 2026 list prices by collection slug
const LIST_PRICES_2026: Record<string, number> = {
  "signature-series": 76,
  "signature-plus-series": 81,
  "london-collection": 81, // titanium models are 97
  "urban-collection": 121,
  "milan-series": 99,
  "classic": 65,
  "louisluso-titanium": 108, // L-800 series is 89
  "grand-collection": 73,
  "rimless-air-series": 68,
  "skylite": 12, // ranges 12-15
  "snf": 130,
  "eyes-cloud-kids": 57,
  "tandy-series": 84,
  "tandy-titanium": 108, // ranges 108-121
  "veritas-classic": 51,
  "veritas-series": 51,
};

// 2026 SRP prices by collection slug
const SRP_2026: Record<string, number> = {
  "signature-series": 227,
  "signature-plus-series": 243,
  "london-collection": 243, // titanium $290 — handled separately if list=$97
  "urban-collection": 362,
  "milan-series": 296,
  "classic": 195,
  "louisluso-titanium": 267, // L-5000 is $324 — handled by list price $108
  "grand-collection": 218,
  "rimless-air-series": 203,
  "skylite": 36,
  "snf": 390,
  "eyes-cloud-kids": 170,
  "tandy-series": 253,
  "tandy-titanium": 324,
  "veritas-classic": 154,
  "veritas-series": 154,
};

async function zohoPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}${path}?organization_id=${ORG_ID}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function zohoPut(apiPath: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}${apiPath}?organization_id=${ORG_ID}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function main(): Promise<void> {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Step 1: Fetch all item groups
  console.log("Fetching all item groups from Zoho...");
  const groups = await getItemGroups();
  console.log(`Found ${groups.length} item groups.\n`);

  // Step 2: Backup current rates
  const backupData = groups.flatMap((g) =>
    (g.items ?? []).map((item) => ({
      group_id: g.group_id,
      group_name: g.group_name,
      item_id: item.item_id,
      name: item.name,
      sku: item.sku,
      rate: item.rate,
    })),
  );

  const backupDir = path.join(__dirname, "data");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "zoho-rates-backup-2026-04-09.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backed up ${backupData.length} item rates to ${backupPath}\n`);

  // Step 3: Identify items needing list price updates
  let updateCount = 0;
  const srpItems: Array<{ item_id: string; pricebook_rate: number }> = [];
  const unmatchedItems: string[] = [];
  const noSrpItems: string[] = [];

  for (const group of groups) {
    const collection = matchCollection(group);
    if (!collection) {
      if (!group.group_name.startsWith("*")) {
        unmatchedItems.push(`${group.group_name} [${group.brand}]`);
      }
      continue;
    }

    const expectedListPrice = LIST_PRICES_2026[collection.slug];
    const srpPrice = SRP_2026[collection.slug];

    for (const item of group.items ?? []) {
      // Check if list price needs updating
      if (expectedListPrice && item.rate !== expectedListPrice) {
        console.log(
          `UPDATE LIST: ${item.name} rate ${item.rate} → ${expectedListPrice} (${collection.name})`,
        );
        if (!DRY_RUN) {
          await zohoPut(`/inventory/v1/items/${item.item_id}`, {
            rate: expectedListPrice,
          });
        }
        updateCount++;
      }

      // Collect SRP entries
      if (srpPrice) {
        srpItems.push({ item_id: item.item_id, pricebook_rate: srpPrice });
      } else {
        noSrpItems.push(`${item.name} [${collection.name}]`);
      }
    }
  }

  console.log(`\nList price updates: ${updateCount}${DRY_RUN ? " (dry run)" : ""}`);

  // Step 4: Create SRP26 price book
  console.log("\nChecking for existing SRP26 price book...");
  const existingBooks = await getPriceBooks();
  const existing = existingBooks.find((pb) => pb.name === "SRP26");

  if (existing) {
    console.log(`SRP26 already exists (id: ${existing.pricebook_id}). Skipping creation.`);
  } else {
    console.log("Creating SRP26 price book...");
    if (!DRY_RUN) {
      const result = await zohoPost("/inventory/v1/pricebooks", {
        name: "SRP26",
        pricebook_type: "per_item",
        currency_id: "", // default currency
        sales_or_purchase_type: "sales",
        pricebook_items: srpItems,
      });
      console.log("SRP26 created:", JSON.stringify(result, null, 2));
    } else {
      console.log(`Would create SRP26 with ${srpItems.length} item prices`);
    }
  }

  // Summary
  if (unmatchedItems.length > 0) {
    console.log(`\nUnmatched items (${unmatchedItems.length}):`);
    unmatchedItems.forEach((i) => console.log(`  - ${i}`));
  }

  if (noSrpItems.length > 0) {
    console.log(`\nItems with no SRP (${noSrpItems.length}):`);
    noSrpItems.slice(0, 10).forEach((i) => console.log(`  - ${i}`));
    if (noSrpItems.length > 10) console.log(`  ... +${noSrpItems.length - 10} more`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
```

- [ ] **Step 2: Test with dry run**

Run: `npx tsx scripts/setup-srp26.ts --dry-run`
Expected: Prints backup info, list of items needing price updates, and SRP26 creation plan without making any changes

- [ ] **Step 3: Run live (after reviewing dry run output)**

Run: `npx tsx scripts/setup-srp26.ts`
Expected: Backs up rates, updates stale list prices, creates SRP26 price book in Zoho

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-srp26.ts scripts/data/
git commit -m "feat: add SRP26 setup script with rate backup"
```

---

## Task 12: Run Full Test Suite & Build Check

Verify everything works together.

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify all pages work locally**

Run: `pnpm dev`
Verify these URLs all render:
- `http://localhost:3000/eyeglasses` — collection grid
- `http://localhost:3000/eyeglasses/signature-series` — product grid with SRP prices
- `http://localhost:3000/sunglasses` — collection grid
- `http://localhost:3000/products/sg-1011` — product detail with variant selector
- `http://localhost:3000/accessories` — coming soon page
- `http://localhost:3000/eyeglasses/nonexistent` — 404 page

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build and test issues"
```
