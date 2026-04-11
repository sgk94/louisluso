# Phase 5b: Partner Catalog Pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a partner is logged in, replace SRP with their wholesale pricing on collection grids and product detail pages. Hide "Find a Dealer" button for partners.

**Architecture:** Add `listingPrice` (from `item.rate`) to the catalog data layer. Create a `PartnerPrice` component that renders 3 states: SRP (public), listing (default partner), or strikethrough + green pill (bespoke partner). Collection and product pages detect partner auth via `currentUser()` and pass pricing context down. A new API route returns bespoke prices from the partner's assigned Price Book.

**Tech Stack:** Next.js 16 App Router, Clerk auth, Zoho Inventory Price Books, Vitest + React Testing Library

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/catalog/types.ts` | Modified: add `listingPrice` to CatalogProduct |
| `lib/catalog/catalog.ts` | Modified: populate `listingPrice` from `item.rate` |
| `app/components/PartnerPrice.tsx` | New: price display component (3 states) |
| `app/api/portal/pricing/route.ts` | New: GET bespoke prices for partner |
| `app/components/ProductCard.tsx` | Modified: use PartnerPrice |
| `app/components/ProductGrid.tsx` | Modified: accept partner pricing props |
| `app/products/[slug]/page.tsx` | Modified: use PartnerPrice, hide dealer button |
| `app/eyeglasses/[collection]/page.tsx` | Modified: pass partner context |
| `app/sunglasses/[collection]/page.tsx` | Modified: pass partner context |

---

### Task 1: Add listingPrice to Catalog Data Layer

**Files:**
- Modify: `lib/catalog/types.ts`
- Modify: `lib/catalog/catalog.ts`
- Modify: `__tests__/lib/catalog/catalog.test.ts`

- [ ] **Step 1: Update CatalogProduct type**

Edit `lib/catalog/types.ts` — add `listingPrice` field to `CatalogProduct`:

```typescript
export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  srp: number | null;
  listingPrice: number;  // wholesale base price from item.rate
  image: string | null;
  variants: CatalogVariant[];
  dimensions: CatalogDimensions | null;
}
```

- [ ] **Step 2: Populate listingPrice in catalog.ts**

Edit `lib/catalog/catalog.ts` — in the `groupToProduct` function, add `listingPrice` extraction. The function already has access to `group.items`. Add after the `srp` calculation:

```typescript
const listingPrice = group.items?.[0]?.rate ?? 0;
```

And include it in the returned `CatalogProduct`:

```typescript
return {
  id: group.group_id,
  slug: group.group_name.toLowerCase(),
  name: group.group_name,
  srp,
  listingPrice,
  image: getProductImageUrl(group.group_name),
  variants,
  dimensions,
};
```

- [ ] **Step 3: Update catalog test**

Edit `__tests__/lib/catalog/catalog.test.ts` — add a test verifying `listingPrice` is populated. Add after the existing `getCollectionProducts` test block:

```typescript
it("includes listingPrice from item.rate", async () => {
  makeItemGroups();
  makeSrpPriceBooks();
  const result = await getCollectionProducts("signature-series");
  expect(result).not.toBeNull();
  expect(result!.products[0].listingPrice).toBe(76);
});
```

- [ ] **Step 4: Update ProductCard test helper**

Edit `__tests__/app/components/ProductCard.test.tsx` — add `listingPrice` to the `makeProduct` helper:

```typescript
function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "g1",
    slug: "sg-1011",
    name: "SG-1011",
    srp: 227,
    listingPrice: 76,
    image: "/images/placeholder-frame.svg",
    variants: [
      { id: "v1", colorCode: "C1", colorName: "Black Glossed", inStock: true, image: null },
      { id: "v2", colorCode: "C2", colorName: "Black Matte", inStock: true, image: null },
    ],
    dimensions: { lens: 56, bridge: 17, temple: 140 },
    ...overrides,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/catalog/types.ts lib/catalog/catalog.ts __tests__/lib/catalog/catalog.test.ts __tests__/app/components/ProductCard.test.tsx
git commit -m "feat: add listingPrice to CatalogProduct from item.rate"
```

---

### Task 2: PartnerPrice Component

**Files:**
- Create: `app/components/PartnerPrice.tsx`
- Test: `__tests__/app/components/PartnerPrice.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/PartnerPrice.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnerPrice } from "@/app/components/PartnerPrice";

describe("PartnerPrice", () => {
  it("renders SRP for public visitors", () => {
    render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={null} isPartner={false} />);
    expect(screen.getByText("$227")).toBeInTheDocument();
    expect(screen.queryByText("$76")).not.toBeInTheDocument();
  });

  it("renders 'Contact for pricing' when SRP is null and not partner", () => {
    render(<PartnerPrice srp={null} listingPrice={76} bespokePrice={null} isPartner={false} />);
    expect(screen.getByText("Contact for pricing")).toBeInTheDocument();
  });

  it("renders listing price for default partner", () => {
    render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={null} isPartner={true} />);
    expect(screen.getByText("$76")).toBeInTheDocument();
    expect(screen.queryByText("$227")).not.toBeInTheDocument();
  });

  it("renders strikethrough listing + green pill for bespoke partner", () => {
    const { container } = render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={68} isPartner={true} />);
    // Strikethrough listing price
    const strikethrough = container.querySelector("s");
    expect(strikethrough).not.toBeNull();
    expect(strikethrough?.textContent).toBe("$76");
    // Green pill with bespoke price
    expect(screen.getByText("$68")).toBeInTheDocument();
  });

  it("renders listing price when bespoke matches listing", () => {
    render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={76} isPartner={true} />);
    // No strikethrough needed — prices are the same
    const { container } = render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={76} isPartner={true} />);
    expect(container.querySelector("s")).toBeNull();
    expect(screen.getAllByText("$76").length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/components/PartnerPrice.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PartnerPrice**

Create `app/components/PartnerPrice.tsx`:

```tsx
import { formatPrice } from "@/lib/catalog/format";

interface PartnerPriceProps {
  srp: number | null;
  listingPrice: number;
  bespokePrice: number | null;
  isPartner: boolean;
  size?: "sm" | "lg";
}

export function PartnerPrice({ srp, listingPrice, bespokePrice, isPartner, size = "sm" }: PartnerPriceProps): React.ReactElement {
  const textClass = size === "lg" ? "text-xl" : "text-sm";

  // Public visitor — show SRP
  if (!isPartner) {
    if (srp === null) {
      return <p className={`${size === "lg" ? "text-sm" : "text-xs"} text-gray-400`}>Contact for pricing</p>;
    }
    return <p className={`${textClass} text-gray-600`}>{formatPrice(srp)}</p>;
  }

  // Partner with bespoke pricing different from listing
  if (bespokePrice !== null && bespokePrice !== listingPrice) {
    return (
      <div className={`flex items-center gap-2 ${textClass}`}>
        <s className="text-gray-400">{formatPrice(listingPrice)}</s>
        <span className="rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          {formatPrice(bespokePrice)}
        </span>
      </div>
    );
  }

  // Partner — show listing price (default wholesale)
  return <p className={`${textClass} text-gray-600`}>{formatPrice(listingPrice)}</p>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/components/PartnerPrice.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/PartnerPrice.tsx __tests__/app/components/PartnerPrice.test.tsx
git commit -m "feat: add PartnerPrice component with 3 pricing states"
```

---

### Task 3: GET /api/portal/pricing Route

**Files:**
- Create: `app/api/portal/pricing/route.ts`
- Test: `__tests__/app/api/portal/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/portal/pricing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetPriceBook } = vi.hoisted(() => ({ mockGetPriceBook: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/inventory", () => ({ getPriceBook: mockGetPriceBook }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { GET } from "@/app/api/portal/pricing/route";

function makeRequest(items: string): Request {
  return new Request(`http://localhost/api/portal/pricing?items=${items}`);
}

describe("GET /api/portal/pricing", () => {
  beforeEach(() => {
    mockGetPriceBook.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const response = await GET(makeRequest("item-1,item-2"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({ id: "u1", publicMetadata: {} });
    const response = await GET(makeRequest("item-1,item-2"));
    expect(response.status).toBe(403);
  });

  it("returns type 'listing' when partner has no pricingPlanId", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
    });
    const response = await GET(makeRequest("item-1"));
    const data = await response.json();
    expect(data.type).toBe("listing");
  });

  it("returns bespoke prices when partner has pricingPlanId", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test", pricingPlanId: "pb-1" },
    });
    mockGetPriceBook.mockResolvedValue({
      pricebook_id: "pb-1",
      name: "Wholesale 20%",
      pricebook_items: [
        { item_id: "item-1", pricebook_rate: 60 },
        { item_id: "item-2", pricebook_rate: 65 },
        { item_id: "item-99", pricebook_rate: 100 },
      ],
    });
    const response = await GET(makeRequest("item-1,item-2"));
    const data = await response.json();
    expect(data.type).toBe("bespoke");
    expect(data.prices["item-1"]).toBe(60);
    expect(data.prices["item-2"]).toBe(65);
    expect(data.prices["item-99"]).toBeUndefined();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
    });
    const response = await GET(makeRequest("item-1"));
    expect(response.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/api/portal/pricing.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pricing route**

Create `app/api/portal/pricing/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { getPriceBook } from "@/lib/zoho/inventory";
import { rateLimit } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";

export async function GET(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isPartner(user.publicMetadata)) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  const { pricingPlanId } = user.publicMetadata;

  if (!pricingPlanId) {
    return NextResponse.json({ type: "listing" });
  }

  const url = new URL(request.url);
  const itemsParam = url.searchParams.get("items") ?? "";
  const requestedIds = new Set(itemsParam.split(",").filter(Boolean));

  const priceBook = await getPriceBook(pricingPlanId);
  const prices: Record<string, number> = {};

  for (const item of priceBook.pricebook_items ?? []) {
    if (requestedIds.has(item.item_id)) {
      prices[item.item_id] = item.pricebook_rate;
    }
  }

  return NextResponse.json({ type: "bespoke", prices });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/api/portal/pricing.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/portal/pricing/route.ts __tests__/app/api/portal/pricing.test.ts
git commit -m "feat: add GET /api/portal/pricing for bespoke prices"
```

---

### Task 4: Update ProductCard with Partner Pricing

**Files:**
- Modify: `app/components/ProductCard.tsx`
- Modify: `app/components/ProductGrid.tsx`
- Modify: `__tests__/app/components/ProductCard.test.tsx`

- [ ] **Step 1: Add partner pricing tests to ProductCard**

Add to `__tests__/app/components/ProductCard.test.tsx`:

```tsx
it("renders listing price when isPartner is true", () => {
  render(<ProductCard product={makeProduct({ listingPrice: 76 })} isPartner={true} bespokePrice={null} />);
  expect(screen.getByText("$76")).toBeInTheDocument();
  expect(screen.queryByText("$227")).not.toBeInTheDocument();
});

it("renders strikethrough + pill for bespoke partner", () => {
  const { container } = render(<ProductCard product={makeProduct({ listingPrice: 76 })} isPartner={true} bespokePrice={68} />);
  const strikethrough = container.querySelector("s");
  expect(strikethrough?.textContent).toBe("$76");
  expect(screen.getByText("$68")).toBeInTheDocument();
});
```

- [ ] **Step 2: Update ProductCard to use PartnerPrice**

Edit `app/components/ProductCard.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import type { CatalogProduct } from "@/lib/catalog/types";
import { PartnerPrice } from "./PartnerPrice";

interface ProductCardProps {
  product: CatalogProduct;
  isPartner?: boolean;
  bespokePrice?: number | null;
}

export function ProductCard({ product, isPartner = false, bespokePrice = null }: ProductCardProps): React.ReactElement {
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
        <div className="mt-1">
          <PartnerPrice
            srp={product.srp}
            listingPrice={product.listingPrice}
            bespokePrice={bespokePrice}
            isPartner={isPartner}
          />
        </div>
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

- [ ] **Step 3: Update ProductGrid to pass partner props**

Edit `app/components/ProductGrid.tsx`:

```tsx
import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: CatalogProduct[];
  isPartner?: boolean;
  bespokePrices?: Record<string, number>;
}

export function ProductGrid({
  products,
  isPartner = false,
  bespokePrices,
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
      {products.map((product) => {
        const firstVariantId = product.variants[0]?.id;
        const bespokePrice = firstVariantId && bespokePrices ? bespokePrices[firstVariantId] ?? null : null;
        return (
          <ProductCard
            key={product.id}
            product={product}
            isPartner={isPartner}
            bespokePrice={bespokePrice}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/ProductCard.tsx app/components/ProductGrid.tsx __tests__/app/components/ProductCard.test.tsx
git commit -m "feat: update ProductCard and ProductGrid with partner pricing"
```

---

### Task 5: Update Collection Pages with Partner Context

**Files:**
- Modify: `app/eyeglasses/[collection]/page.tsx`
- Modify: `app/sunglasses/[collection]/page.tsx`

- [ ] **Step 1: Update eyeglasses collection page**

Edit `app/eyeglasses/[collection]/page.tsx` — add auth check and pass partner context:

Add import at top:
```tsx
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
```

In the `EyeglassesCollectionPage` function, after `const data = await getCollectionProducts(slug);`, add:

```tsx
const user = await currentUser();
const partner = user ? isPartner(user.publicMetadata) : false;
```

Update the `<ProductGrid>` usage:

```tsx
<ProductGrid products={data.products} isPartner={partner} />
```

- [ ] **Step 2: Update sunglasses collection page**

Edit `app/sunglasses/[collection]/page.tsx` — same changes as eyeglasses:

Add imports:
```tsx
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
```

Add auth check in the page function:
```tsx
const user = await currentUser();
const partner = user ? isPartner(user.publicMetadata) : false;
```

Update `<ProductGrid>`:
```tsx
<ProductGrid products={data.products} isPartner={partner} />
```

- [ ] **Step 3: Commit**

```bash
git add app/eyeglasses/[collection]/page.tsx app/sunglasses/[collection]/page.tsx
git commit -m "feat: pass partner context to collection pages"
```

---

### Task 6: Update Product Detail Page

**Files:**
- Modify: `app/products/[slug]/page.tsx`

- [ ] **Step 1: Update product detail page**

Edit `app/products/[slug]/page.tsx`:

Add imports at top:
```tsx
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { PartnerPrice } from "@/app/components/PartnerPrice";
```

In the `ProductDetailPage` function, after `const { product, collection } = data;`, add:

```tsx
const user = await currentUser();
const partner = user ? isPartner(user.publicMetadata) : false;
```

Replace the price display section (the `{product.srp !== null ? ...}` block):

```tsx
<div className="mt-2">
  <PartnerPrice
    srp={product.srp}
    listingPrice={product.listingPrice}
    bespokePrice={null}
    isPartner={partner}
    size="lg"
  />
</div>
```

Replace the "Find Nearest Dealer" section conditionally:

```tsx
{!partner && (
  <div className="mt-8">
    <Link
      href="/find-a-dealer"
      className="inline-block w-full border border-black px-8 py-3 text-center text-sm font-medium uppercase tracking-wide transition-colors hover:bg-black hover:text-white"
    >
      Find Nearest Dealer
    </Link>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add app/products/[slug]/page.tsx
git commit -m "feat: show partner pricing on product detail, hide dealer button"
```

---

### Task 7: Full Test Suite + Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address Phase 5b build/test issues"
```
