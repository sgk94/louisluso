# Phase 5c: Cart/Quote + Zoho Estimate — Design Spec

## Overview

Partners can add items to a quote from product detail pages, review/edit in a quote builder, and submit. Submission creates a Zoho Books Estimate. Ken reviews, confirms stock, and converts to Sales Order → Invoice. Email notifications at each stage.

---

## Flow

1. Partner browses catalog → sees listing/bespoke pricing (5b)
2. On product detail, selects quantities per variant → "Add to Quote"
3. Cart icon in nav shows count badge
4. Partner visits `/portal/quote` → reviews, edits quantities, removes items
5. Submits → Zoho Books Estimate created → email: "We've received your quote"
6. Ken reviews in Zoho Books → converts Estimate to Sales Order → Invoice with Stripe link
7. Dealer gets email at each stage (handled by Zoho, not the website)

### Why Estimate, not Sales Order

- Estimates are non-binding — don't affect inventory counts
- Ken can review stock availability before committing
- Handles concurrent orders gracefully — no automated inventory reservation
- Ken decides priority when stock is limited (first-come or VIP accounts)

---

## Cart State

- **Storage:** localStorage, key `louisluso-cart`
- **Shape:**

```typescript
interface CartItem {
  itemId: string;       // Zoho item ID (variant)
  productId: string;    // Zoho group ID (parent product)
  productName: string;
  colorName: string;
  quantity: number;
  price: number;        // listing or bespoke price at time of add
}

interface Cart {
  items: CartItem[];
  updatedAt: string;    // ISO timestamp
}
```

- **React context:** `CartProvider` wraps the app for partners, provides `useCart()` hook
- **Operations:** `addItems(items[])`, `updateQuantity(itemId, qty)`, `removeItem(itemId)`, `clearCart()`
- Cart badge count = sum of all quantities

---

## Navigation Changes

### Public Visitor

```
[Find a Dealer] [Login]
```

No heart icon, no cart icon.

### Partner

```
[Find a Dealer] [Cart 🛍] [UserMenu 👤]
```

- Cart icon: `ShoppingBagIcon` from Heroicons
- Bronze count badge when items > 0
- Clicking navigates to `/portal/quote`

### Existing Changes

- Remove the favorites heart icon from nav (for both public and partners)
- Heart icon currently links to `/portal` — not useful

---

## Product Detail — Add to Quote (Partners Only)

### Variant Quantity Table

Replaces the current variant selector when user is a partner. Shows all variants:

| Color | Status | Qty |
|-------|--------|-----|
| C1 — Black Glossed | In Stock | `[  0  ]` |
| C2 — Black Matte | In Stock | `[  0  ]` |
| C3 — Brown | Out of Stock | `[disabled]` |
| C4 — Gold | In Stock | `[  0  ]` |

- Quantity inputs default to 0
- Out-of-stock variants: input disabled, "Out of Stock" label
- **"Add to Quote"** button at bottom — adds all variants with qty > 0 to cart
- Button disabled when all quantities are 0
- After adding: brief success toast/message, quantities reset to 0

### Pricing Context

- Price shown per variant uses the partner's pricing (listing or bespoke from 5b)
- Line total shown per row: qty × price

---

## Quote Page (`/portal/quote`)

### Layout

Dark theme matching portal aesthetic. Table with editable quantities:

| Product | Color | Qty | Unit Price | Total |
|---------|-------|-----|-----------|-------|
| SG-1011 | C1 — Black Glossed | `[ 5 ]` | $76.00 | $380.00 |
| SG-1011 | C2 — Black Matte | `[ 10 ]` | $76.00 | $760.00 |
| LC-9018 | C1 — Gold | `[ 3 ]` | $81.00 | $243.00 |

- Each row has a remove (X) button
- Quantity is editable inline (number input)
- Setting quantity to 0 removes the item
- Summary footer: total items count + subtotal

### Actions

- **"Submit Quote"** button — creates Zoho Books Estimate
- **"Continue Shopping"** link → `/eyeglasses`
- **"Clear All"** link — clears cart with confirmation

### Empty State

"Your quote is empty. Browse our collections to get started." + link to `/eyeglasses`

### Submit Flow

1. Click "Submit Quote"
2. Loading state on button
3. POST to `/api/portal/quote`
4. Success → show confirmation: "Your quote has been submitted (EST-XXXXX). We'll confirm availability shortly."
5. Cart cleared
6. Error → show error message, cart preserved

---

## API Route

### `POST /api/portal/quote`

- **Auth:** requires Clerk session with partner role
- **Rate limited:** per IP
- **Request body:**

```typescript
{
  items: Array<{
    itemId: string;
    quantity: number;
    price: number;
  }>;
  notes?: string;
}
```

- **Logic:**
  1. Validate auth + partner role
  2. Read `zohoContactId` from Clerk metadata
  3. Validate items (non-empty, quantities > 0)
  4. Create Estimate in Zoho Books with line items
  5. Send confirmation email to partner via Gmail API
  6. Return `{ success: true, estimateNumber: "EST-XXXXX" }`

- **Email:**
  - From: cs@louisluso.com
  - To: partner's email (from Clerk)
  - Subject: "LOUISLUSO Quote Received — [EST-XXXXX]"
  - Body: quote summary, line items, total, "We'll review and confirm availability"

---

## Zoho Books Extension

Add to `lib/zoho/books.ts`:

```typescript
export async function createEstimate(
  customerId: string,
  lineItems: Array<{ item_id: string; quantity: number; rate: number }>,
  notes?: string,
): Promise<{ estimate_number: string; estimate_id: string }>
```

Uses Zoho Books Estimates API: `POST /books/v3/estimates`

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `lib/portal/cart.ts` | Cart state management (localStorage + React context) |
| `app/portal/quote/page.tsx` | Quote review/edit page |
| `app/components/CartIcon.tsx` | Cart bag icon with count badge |
| `app/components/VariantQuoteTable.tsx` | Per-variant quantity table for product detail |
| `app/api/portal/quote/route.ts` | POST: create Zoho Books Estimate |
| `lib/schemas/quote.ts` | Zod schema for quote submission |

### Modified Files

| File | Change |
|------|--------|
| `lib/zoho/books.ts` | Add `createEstimate()` |
| `app/products/[slug]/page.tsx` | Show VariantQuoteTable for partners instead of VariantSelector |
| `app/components/Navigation.tsx` | Remove heart icon, add CartIcon for partners |
| `app/components/MobileMenu.tsx` | Remove heart icon reference |
| `app/layout.tsx` | Wrap in CartProvider for partners |

---

## Dependencies

No new packages. Uses existing:
- `@clerk/nextjs` — auth
- `googleapis` — Gmail for confirmation email
- `@heroicons/react` — ShoppingBagIcon
- `@upstash/ratelimit` — rate limiting
- `zod` — validation

---

## Testing

### Unit Tests
- `__tests__/lib/portal/cart.test.ts` — add, update, remove, clear, localStorage persistence
- `__tests__/lib/schemas/quote.test.ts` — schema validation
- `__tests__/app/api/portal/quote.test.ts` — auth, validation, Zoho call, email

### Component Tests
- `__tests__/app/components/CartIcon.test.tsx` — renders badge, zero state
- `__tests__/app/components/VariantQuoteTable.test.tsx` — qty inputs, OOS disabled, add button

---

## Deferred

- Order history + status tracking (Phase 5d)
- Favorites (Phase 5d)
- One-click reorder (Phase 5d)
- Auto-conversion of Estimate → Sales Order (future scaling)
- Bespoke pricing wiring to collection pages (currently only product detail)
