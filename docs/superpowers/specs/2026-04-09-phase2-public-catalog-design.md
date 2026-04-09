# Phase 2: Public Catalog — Design Spec

## Overview

Build the public-facing product catalog for louisluso.com. Visitors browse collections organized by category (eyeglasses, sunglasses, accessories), view product grids with SRP pricing, and drill into product detail pages showing color variants, dimensions, and material info. All product data comes from Zoho Inventory; SRP pricing comes from a dedicated "SRP26" price book in Zoho.

## Data Architecture

### Collection Config (`lib/collections.ts`)

Static mapping that bridges Zoho Inventory data to the website's collection structure. Zoho has no categories set up — `category_name` is empty on all 296 item groups. Collections are identified by matching SKU prefixes and brand fields.

Each collection entry contains:

```ts
interface Collection {
  slug: string;              // URL slug (e.g., "signature-series")
  name: string;              // Display name (e.g., "Signature Series")
  category: "eyeglasses" | "sunglasses" | "accessories";
  skuPrefix: string;         // Zoho group_name prefix (e.g., "SG-")
  brand: string;             // Zoho brand field (e.g., "LOUISLUSO")
  material: string;          // e.g., "ULTEM", "Titanium", "Acetate"
  fallbackSrp: number | null; // Fallback if SRP price book entry missing
  sortOrder: number;         // Display order on category pages
  isNew?: boolean;           // Show "NEW" badge
  isDiscontinued?: boolean;  // Exclude from site
}
```

### Collection Mapping (from Zoho data investigation)

**Eyeglasses:**

| Collection | Slug | SKU Prefix | Brand | Material | SRP | Products |
|---|---|---|---|---|---|---|
| Signature Series | `signature-series` | `SG-` | LOUISLUSO | ULTEM | $227 | 13 |
| Signature Plus Series | `signature-plus-series` | `SP-` | LOUISLUSO | ULTEM | $243 | 5 |
| London Collection | `london-collection` | `LC-` | LOUISLUSO | Titanium | $243/$290 | 19 |
| Urban Collection | `urban-collection` | `LU-` | LOUISLUSO | Titanium | $362 | 4 |
| Milan Series | `milan-series` | `ML-` | LOUISLUSO | Titanium | $296 | 4 |
| Classic | `classic` | `LL-` | LOUISLUSO | ULTEM | $195 | 22 |
| Junior Series | `junior-series` | TBD (assumed `JN-`, not verified in Zoho) | LOUISLUSO | ULTEM | $214 | 4 |
| Louisluso Titanium | `louisluso-titanium` | `LL(T)-` | LOUISLUSO | Titanium | $267/$324 | 15 |
| Grand Collection | `grand-collection` | `GC-` | LOUISLUSO | ULTEM | $218 | 8 |
| Rimless Air Series | `rimless-air-series` | `RA-` | LOUISLUSO | ULTEM | $203 | 3 |
| Skylite | `skylite` | `SL-` | LOUISLUSO | ULTEM | $36-42 | 9 |
| SNF | `snf` | `SNF-` | SNF | ULTEM | $390 | 5 |
| Eye's Cloud Kids | `eyes-cloud-kids` | `EK-` | EYE CLOUD | ULTEM | $170 | 3 |
| Tandy Series | `tandy-series` | `TA-` (non-titanium) | TANDY | ULTEM | $253 | ~26 |
| Tandy Titanium | `tandy-titanium` | `TA(T)-` | TANDY | Titanium | $324-362 | ~18 |
| TANI | `tani` | `T-` | *(not in Zoho yet)* | ULTEM | TBD | 0 |
| Veritas Classic | `veritas-classic` | `VT-` (subset) | VERITAS | ULTEM | $154 | 9 |
| Veritas Series | `veritas-series` | `VT-` (subset) | VERITAS | ULTEM | $154 | 10 |
| Manomos Glasses | `manomos-glasses` | *(by brand, no "Sunglass" in SKU)* | MANOMOS | Acetate | TBD | ~40 |
| Close Out / ABBR | `close-out` | `AB-` | LOUISLUSO | Mixed | TBD | 5 |

**Sunglasses:**

| Collection | Slug | SKU Prefix | Brand | Material | SRP | Products |
|---|---|---|---|---|---|---|
| Manomos Sunglasses | `manomos-sunglasses` | *(by brand, "Sunglass" in SKU)* | MANOMOS | Acetate | TBD | ~32 |

**Accessories:**

| Collection | Slug | Brand | SRP | Products |
|---|---|---|---|---|
| Accessories | `accessories` | — | TBD | TBD |

**Excluded:**
- CLROTTE (23 products) — discontinued
- Dr. GRAM — discontinued (not in Zoho)
- AKIO (7 products) — not on WooCommerce site, $10 list price, likely not retail
- POP UP STORE items (6 products) — internal use
- `[LXIV] VERITAS OLD` — legacy item

### Zoho → Collection Matching Logic

Products are matched to collections by:

1. Check `brand` field first (MANOMOS, TANDY, VERITAS, SNF, EYE CLOUD)
2. For LOUISLUSO brand, match `group_name` prefix (SG-, LC-, LU-, ML-, SP-, LL-, LL(T)-, GC-, RA-, SL-, AB-)
3. For MANOMOS, distinguish glasses vs sunglasses by checking variant SKU text for "Sunglass"
4. For TANDY, distinguish Tandy vs Tandy Titanium by checking for `(T)` in group_name
5. For LOUISLUSO Titanium, split L-800 series (`LL(T)-8xxx`) from L-5000 series (`LL(T)-5xxx`) — both under one collection on the website
6. For VERITAS, split Classic vs Series by cross-referencing WooCommerce category assignments (fetch each VT- product from WC API, check which category it belongs to)
7. Unmatched products are excluded from the public catalog

### Manomos Glasses vs Sunglasses Detection

The MANOMOS brand (72 items) contains both eyeglasses and sunglasses. In Zoho, the only differentiator is the variant SKU text — sunglasses have "Sunglass" appended (e.g., `MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass`).

Detection: check if ANY variant's SKU contains "Sunglass" (case-insensitive) → sunglasses collection. Otherwise → eyeglasses collection.

### SRP Pricing

**Source:** "SRP26" price book in Zoho Inventory (to be created as setup step).

**Per-item prices** populated from the 2026 price table. Each Zoho item variant gets its SRP set based on its collection membership:

| Collection | SRP |
|---|---|
| Eye's Cloud Kids | $170 |
| Classic | $195 |
| Junior Series | $214 |
| Signature Series | $227 |
| Signature Plus Series | $243 |
| London Collection | $243 |
| London Titanium* | $290 |
| Milan Series | $296 |
| Veritas (both) | $154 |
| LL Titanium (L-800) | $267 |
| LL Titanium (L-5000) | $324 |
| Tandy Series | $253 |
| Tandy Titanium | $324-362 |
| Urban Collection | $362 |
| Grand Collection | $218 |
| SNF | $390 |
| Rimless Air | $203 |
| Skylite | $36-42 |

*London Collection has two tiers: standard ($243) and titanium ($290). Titanium models identifiable by "Titanium" in WooCommerce category or higher list price ($97 vs $81).

**Collections with TBD SRP:** TANI, Manomos Glasses, Manomos Sunglasses, Close Out/ABBR, Accessories. These display without price until SRP is set.

**Fallback:** If a product has no SRP26 price book entry, the collection's `fallbackSrp` is used. If that's also null, price is hidden ("Contact for pricing").

### Color Variant Data

Color names are embedded in Zoho variant SKU text. Pattern: `CO.{number} {COLOR NAME}` or `C{number}. {COLOR NAME}`.

Examples:
- `SIGNATURE 56/17/140  CO.1  BLACK GLOSSED` → color: "Black Glossed"
- `MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass` → color: "Gold Green"

**Parser extracts:**
- Color code (C1, C2, etc.)
- Color name (Black Glossed, Brown Matte, etc.)

### Dimensions

Parsed from Zoho variant SKU text. Pattern: `{lens}/{bridge}/{temple}` (e.g., `56/17/140`).

All variants in a group share the same dimensions, so parse from the first variant.

### Stock Status

From Zoho `stock_on_hand` field per variant:
- `> 0` → in stock
- `= 0` → "Temporarily Out of Stock" badge, product stays visible, browsable

---

## Routes & Pages

### `/eyeglasses`

Category page showing a grid of eyeglasses collection cards.

- Source: collection config filtered by `category: "eyeglasses"`
- Rendering: static (collection list doesn't change without a deploy)
- Each card: collection name, representative image (placeholder initially), product count
- "NEW" badge on collections flagged `isNew`

### `/eyeglasses/[collection]`

Product grid for a specific collection.

- Source: Zoho item groups matched to collection via SKU prefix/brand
- Rendering: ISR (15 min revalidation)
- Validates `[collection]` slug against collection config — 404 for invalid slugs
- Each product card: main image (placeholder), model name, SRP, color swatches (colored dots)
- Filter: by color (optional, nice-to-have for Phase 2)
- Sort: default by model number

### `/sunglasses` and `/sunglasses/[collection]`

Same structure as eyeglasses routes.

### `/accessories`

Single page listing accessories. Same ISR pattern.

### `/products/[slug]`

Product detail page.

- Source: Zoho item group by ID or slug mapping
- Rendering: ISR (15 min revalidation)
- Slug format: lowercase model name (e.g., `sg-1011`)
- Content:
  - Large product image (placeholder initially)
  - Color variant selector — clicking a color shows that variant's image
  - SRP price (from SRP26 price book)
  - Dimensions: lens width, bridge width, temple length (parsed from SKU)
  - Material (from collection config)
  - Stock status per variant
  - "Temporarily Out of Stock" badge on OOS variants
  - Breadcrumb: Eyeglasses > Signature Series > SG-1011
- "Find Nearest Dealer" button — **placeholder link for Phase 2**, functional in Phase 4

---

## API Routes

### `GET /api/catalog/collections`

Returns the full collection config. Used by category pages.

### `GET /api/catalog/collections/[slug]`

Returns products for a specific collection, merged with SRP pricing.

Response shape:
```ts
{
  collection: {
    slug: string;
    name: string;
    category: string;
    material: string;
  };
  products: Array<{
    id: string;           // Zoho group_id
    slug: string;         // URL slug (lowercase group_name)
    name: string;         // group_name
    srp: number | null;   // From SRP26 price book
    image: string | null; // Placeholder for now
    variants: Array<{
      id: string;
      colorCode: string;  // "C1", "C2", etc.
      colorName: string;  // "Black Glossed"
      inStock: boolean;
      image: string | null;
    }>;
    dimensions: {
      lens: number;
      bridge: number;
      temple: number;
    } | null;
  }>;
}
```

### `GET /api/catalog/products/[slug]`

Returns a single product with full variant detail and SRP pricing.

---

## Data Flow

```
Zoho Inventory                    SRP26 Price Book
  (item groups + variants)          (per-item SRP)
         │                               │
         └──────────┬────────────────────┘
                    ▼
         API Route (server-side)
         - Fetch item groups
         - Fetch SRP26 prices
         - Match products → collections via config
         - Parse color names from SKU
         - Parse dimensions from SKU
         - Merge SRP onto each product
         - Filter out excluded products
                    │
                    ▼
            ISR Cache (15 min)
                    │
                    ▼
         React Server Components
         - Category pages (collection grids)
         - Collection pages (product grids)
         - Product detail pages
```

---

## Setup Prerequisites (before implementation)

### 1. Create SRP26 Price Book

Script to run once:

1. `POST /inventory/v1/pricebooks` — create "SRP26" price book (type: `per_item`, sales)
2. Fetch all item groups from Zoho
3. Map each item to its collection via SKU prefix/brand
4. Look up SRP from the 2026 price table
5. Set each variant's price in the SRP26 price book
6. Log items with TBD SRP (TANI, Manomos, Close Out, Accessories) for later manual entry

### 2. Fix Price Book API Path

Current `lib/zoho/inventory.ts` uses `/inventory/v1/pricelists` — wrong. Correct endpoint is `/inventory/v1/pricebooks`. Update the wrapper functions.

---

## SKU Parsing

### Color Parser

```
Input:  "SIGNATURE 56/17/140  CO.1  BLACK GLOSSED"
Output: { colorCode: "C1", colorName: "Black Glossed" }

Input:  "MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass"
Output: { colorCode: "C1", colorName: "Gold Green" }
```

Regex patterns to handle both formats:
- `CO\.(\d+)\s+(.+?)(?:\s+Sunglass)?$`
- `C(\d+)\.\s+(.+?)(?:\s+Sunglass)?$`

### Dimension Parser

```
Input:  "SIGNATURE 56/17/140  CO.1  BLACK GLOSSED"
Output: { lens: 56, bridge: 17, temple: 140 }
```

Regex: `(\d{2,3})\/(\d{2,3})\/(\d{2,3})`

---

## Images Strategy (Phase 2)

Phase 2 uses **placeholder images only**. Cloudinary integration and WooCommerce image migration happen as a separate task.

- Generic LOUISLUSO frame silhouette placeholder
- Different placeholder per category (eyeglasses, sunglasses, accessories) if available
- Image component built with Cloudinary URL structure ready — switching from placeholder to real images requires only updating the image URL function
- Uses Next.js `<Image>` component with proper sizing/lazy loading

Planned Cloudinary URL pattern (for when real images are added):
```
https://res.cloudinary.com/dctwzk6sn/image/upload/products/{SKU}/{view}.jpg
```

---

## Data Gaps (Ken action items)

| Item | Status | Required for |
|---|---|---|
| Add TANI products (T-72xx) to Zoho Inventory | Missing from Zoho | TANI to appear on new site |
| Add 2026 new collections to Zoho (SG4041-4048, LC9050-9055, LU3001-3005) | Missing from Zoho | 2026 lines to appear |
| Provide SRP for: TANI, Manomos, Close Out/ABBR, Accessories | TBD | Show prices for these collections |
| Verify Junior Series SKU prefix in Zoho | Assumed `JN-`, not confirmed | Junior collection matching |

---

## Out of Scope

- B2B pricing / portal catalog (Phase 5)
- "Find Nearest Dealer" functionality (Phase 4 — button is placeholder)
- Image migration from WooCommerce to Cloudinary (separate task)
- Product search / full-text search
- "NEW" badge management via Zoho custom field (deferred — hardcoded in collection config for now)
- "Notify When In Stock" subscription (deferred to Phase 5 portal work)
- Color-based filtering on collection pages (nice-to-have, not required)

---

## Testing

- Unit tests for SKU parsers (color, dimensions)
- Unit tests for collection matching logic
- Integration tests for API routes (mock Zoho responses)
- Test 404 handling for invalid collection slugs and product slugs
- Test SRP fallback behavior (missing price book entry → fallback → null)
- Test stock status display logic
