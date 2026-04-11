# Phase 5b: Partner Catalog Pricing — Design Spec

## Overview

When a partner is logged in, the existing public catalog pages swap SRP for their wholesale pricing. No new pages — conditional rendering on collection grids and product detail pages. Also hides "Find a Dealer" button for partners (they are dealers).

---

## Pricing Logic

Three states based on user context:

1. **Public visitor:** sees SRP (from SRP26 Price Book) — no change from current behavior
2. **Partner without pricingPlanId:** sees listing price (`item.rate` from Zoho Inventory)
3. **Partner with pricingPlanId:** sees listing price struck through + green pill with their bespoke price from their assigned Price Book

---

## Price Display

### Product Cards (Collection Grid)

- **Public:** `$227`
- **Partner (default):** `$76`
- **Partner (bespoke):** ~~`$76`~~ `$68` (green pill)

### Product Detail Page

- Same treatment as cards, larger text
- "Find a Dealer" button **hidden** for partners
- Product info, images, variant selector unchanged

### PartnerPrice Component

Reusable component that renders the correct price state:

```tsx
<PartnerPrice
  srp={227}           // always available
  listingPrice={76}   // always available
  bespokePrice={68}   // only if partner has pricingPlanId and item has a custom rate
  isPartner={true}    // from auth context
/>
```

Renders:
- Not partner → `$227` (SRP)
- Partner, no bespoke → `$76` (listing price)
- Partner, bespoke → ~~`$76`~~ green pill `$68`

### Green Pill Styling

- Background: `bg-green-500/15`
- Text: `text-green-400`
- Border: `border border-green-500/30`
- Rounded: `rounded-full`
- Padding: `px-2.5 py-0.5`
- Font: `text-xs font-semibold`

---

## Data Flow

1. Collection/product pages check if user is a partner via `currentUser()` from Clerk
2. If partner → listing prices already available (adding `item.rate` to catalog data layer)
3. If partner has `pricingPlanId` → client fetches bespoke prices from `/api/portal/pricing`
4. Components render conditionally based on pricing state

---

## API Route

### `GET /api/portal/pricing`

- **Auth:** requires Clerk session with partner role
- **Query params:** `items` — comma-separated item IDs (e.g., `?items=123,456,789`)
- **Logic:**
  1. Read `pricingPlanId` from Clerk metadata
  2. If no `pricingPlanId` → return `{ type: "listing" }`
  3. If `pricingPlanId` → fetch Price Book via `getPriceBook(pricingPlanId)`
  4. Filter to requested item IDs
  5. Return `{ type: "bespoke", prices: { [itemId]: number } }`
- **Rate limited** per IP
- **Cached:** Price Book data can be cached in-memory per request (React.cache)

---

## Catalog Data Layer Changes

### Add `listingPrice` to CatalogProduct

Currently `CatalogProduct` has `srp: number | null`. Add `listingPrice: number` sourced from `item.rate` (the base rate on each Zoho Inventory item).

In `lib/catalog/catalog.ts`, the `groupToProduct` function already has access to `group.items[].rate`. Extract the first item's rate as the product-level listing price.

### Updated Types

```typescript
// lib/catalog/types.ts
interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  srp: number | null;
  listingPrice: number;  // NEW — from item.rate
  image: string;
  variants: CatalogVariant[];
  dimensions: string | null;
}
```

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/components/PartnerPrice.tsx` | Price display component (3 states: SRP, listing, bespoke) |
| `app/api/portal/pricing/route.ts` | GET partner's bespoke prices |

### Modified Files

| File | Change |
|------|--------|
| `lib/catalog/types.ts` | Add `listingPrice: number` to `CatalogProduct` |
| `lib/catalog/catalog.ts` | Populate `listingPrice` from `item.rate` in `groupToProduct` |
| `app/products/[slug]/page.tsx` | Use `PartnerPrice`, hide "Find a Dealer" for partners |
| `app/components/ProductCard.tsx` | Use `PartnerPrice` instead of direct SRP display |
| `app/eyeglasses/[collection]/page.tsx` | Pass partner context to ProductGrid |
| `app/sunglasses/[collection]/page.tsx` | Pass partner context to ProductGrid |
| `app/components/ProductGrid.tsx` | Accept and pass partner pricing props |

---

## Dependencies

No new packages. Uses existing:
- `@clerk/nextjs` — auth context
- `@upstash/ratelimit` — API rate limiting

---

## Testing

### Unit Tests
- `__tests__/app/components/PartnerPrice.test.tsx` — renders SRP for public, listing for partner, strikethrough + pill for bespoke
- `__tests__/app/api/portal/pricing.test.ts` — auth required, returns listing type, returns bespoke prices

### Existing Tests
- Update `__tests__/lib/catalog/catalog.test.ts` — verify `listingPrice` populated
- Update `__tests__/app/components/ProductCard.test.tsx` — verify partner price rendering

---

## Deferred

- "Add to Quote" button (Phase 5c)
- Cart icon + count badge (Phase 5c)
- Cart state management (Phase 5c)
