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

  if (EXCLUDED_BRANDS.has(brand)) return null;
  if (EXCLUDED_NAME_PREFIXES.some((p) => name.startsWith(p))) return null;

  if (brand === "MANOMOS") {
    const isSunglass = group.items?.some((item) =>
      item.sku.toLowerCase().includes("sunglass"),
    );
    return isSunglass
      ? (getCollectionBySlug("manomos-sunglasses") ?? null)
      : (getCollectionBySlug("manomos-glasses") ?? null);
  }

  if (brand === "TANDY") {
    return name.includes("(T)")
      ? (getCollectionBySlug("tandy-titanium") ?? null)
      : (getCollectionBySlug("tandy-series") ?? null);
  }

  if (brand === "VERITAS") {
    return getCollectionBySlug("veritas-classic") ?? null;
  }

  if (brand === "SNF") return getCollectionBySlug("snf") ?? null;
  if (brand === "EYE CLOUD") return getCollectionBySlug("eyes-cloud-kids") ?? null;

  if (brand === "LOUISLUSO") {
    // LL(T)- must be checked before LL- to avoid prefix collision
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
