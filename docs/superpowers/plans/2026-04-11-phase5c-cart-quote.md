# Phase 5c: Cart/Quote + Zoho Estimate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quote/cart system where partners add items per-variant, review/edit on a quote page, and submit to create a Zoho Books Estimate with email confirmation.

**Architecture:** Cart state lives in localStorage via a React context (`CartProvider`). Product detail page shows a variant quantity table for partners. Cart icon in nav with badge count. Quote page lets partners review, edit quantities, and submit. Submission creates a Zoho Books Estimate via API and sends a confirmation email.

**Tech Stack:** Next.js 16 App Router, React Context + localStorage, Zoho Books Estimates API, Gmail API, Clerk auth, Zod, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/portal/cart.ts` | Cart types, localStorage read/write, CartContext + useCart hook |
| `lib/schemas/quote.ts` | Zod schema for quote submission |
| `lib/zoho/books.ts` | Modified: add `createEstimate()` |
| `app/components/CartProvider.tsx` | Client wrapper providing CartContext |
| `app/components/CartIcon.tsx` | Shopping bag icon with count badge |
| `app/components/VariantQuoteTable.tsx` | Per-variant quantity inputs + "Add to Quote" |
| `app/portal/quote/page.tsx` | Quote review/edit page |
| `app/api/portal/quote/route.ts` | POST: create Zoho Books Estimate + send email |
| `app/components/Navigation.tsx` | Modified: remove heart, add CartIcon for partners |
| `app/products/[slug]/page.tsx` | Modified: show VariantQuoteTable for partners |
| `app/layout.tsx` | Modified: wrap in CartProvider |

---

### Task 1: Cart Types and State Management

**Files:**
- Create: `lib/portal/cart.ts`
- Test: `__tests__/lib/portal/cart.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/portal/cart.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadCart, saveCart, addItems, updateQuantity, removeItem, clearCart, type CartItem } from "@/lib/portal/cart";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
  });
});

const item1: CartItem = {
  itemId: "item-1",
  productId: "group-1",
  productName: "SG-1011",
  colorName: "Black Glossed",
  quantity: 5,
  price: 76,
};

const item2: CartItem = {
  itemId: "item-2",
  productId: "group-1",
  productName: "SG-1011",
  colorName: "Black Matte",
  quantity: 10,
  price: 76,
};

describe("cart state", () => {
  it("loadCart returns empty array when no saved cart", () => {
    const cart = loadCart();
    expect(cart).toEqual([]);
  });

  it("saveCart persists and loadCart retrieves", () => {
    saveCart([item1]);
    const cart = loadCart();
    expect(cart).toEqual([item1]);
  });

  it("addItems adds new items", () => {
    const cart = addItems([], [item1, item2]);
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(5);
  });

  it("addItems merges quantity for existing item", () => {
    const existing = [{ ...item1, quantity: 3 }];
    const cart = addItems(existing, [{ ...item1, quantity: 5 }]);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(8);
  });

  it("updateQuantity changes item quantity", () => {
    const cart = updateQuantity([item1, item2], "item-1", 20);
    expect(cart.find((i) => i.itemId === "item-1")?.quantity).toBe(20);
  });

  it("updateQuantity with 0 removes item", () => {
    const cart = updateQuantity([item1, item2], "item-1", 0);
    expect(cart).toHaveLength(1);
    expect(cart[0].itemId).toBe("item-2");
  });

  it("removeItem removes by itemId", () => {
    const cart = removeItem([item1, item2], "item-1");
    expect(cart).toHaveLength(1);
    expect(cart[0].itemId).toBe("item-2");
  });

  it("clearCart returns empty array", () => {
    const cart = clearCart();
    expect(cart).toEqual([]);
  });

  it("getTotalQuantity sums all quantities", () => {
    const { getTotalQuantity } = require("@/lib/portal/cart");
    expect(getTotalQuantity([item1, item2])).toBe(15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/portal/cart.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cart state**

Create `lib/portal/cart.ts`:

```typescript
const CART_KEY = "louisluso-cart";

export interface CartItem {
  itemId: string;
  productId: string;
  productName: string;
  colorName: string;
  quantity: number;
  price: number;
}

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addItems(cart: CartItem[], newItems: CartItem[]): CartItem[] {
  const result = [...cart];
  for (const item of newItems) {
    const existing = result.find((i) => i.itemId === item.itemId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

export function updateQuantity(cart: CartItem[], itemId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return cart.filter((i) => i.itemId !== itemId);
  return cart.map((i) => (i.itemId === itemId ? { ...i, quantity } : i));
}

export function removeItem(cart: CartItem[], itemId: string): CartItem[] {
  return cart.filter((i) => i.itemId !== itemId);
}

export function clearCart(): CartItem[] {
  return [];
}

export function getTotalQuantity(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function getSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/portal/cart.test.ts`
Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/portal/cart.ts __tests__/lib/portal/cart.test.ts
git commit -m "feat: add cart state management with localStorage"
```

---

### Task 2: Quote Submission Schema

**Files:**
- Create: `lib/schemas/quote.ts`
- Test: `__tests__/lib/schemas/quote.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/schemas/quote.test.ts`:

```typescript
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
```

- [ ] **Step 2: Implement schema**

Create `lib/schemas/quote.ts`:

```typescript
import { z } from "zod";

export const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
      }),
    )
    .min(1, "Quote must have at least one item"),
  notes: z.string().max(1000).optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/lib/schemas/quote.test.ts`
Expected: 6 tests PASS

- [ ] **Step 4: Commit**

```bash
git add lib/schemas/quote.ts __tests__/lib/schemas/quote.test.ts
git commit -m "feat: add quote submission Zod schema"
```

---

### Task 3: Zoho Books createEstimate

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: `__tests__/lib/zoho/books-estimate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/zoho/books-estimate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import { createEstimate } from "@/lib/zoho/books";

describe("createEstimate", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("creates an estimate and returns estimate number", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimate: {
        estimate_id: "est-1",
        estimate_number: "EST-00001",
      },
    });

    const result = await createEstimate("customer-1", [
      { item_id: "item-1", quantity: 5, rate: 76 },
    ]);

    expect(result.estimate_number).toBe("EST-00001");
    expect(result.estimate_id).toBe("est-1");
    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      method: "POST",
      body: {
        customer_id: "customer-1",
        line_items: [{ item_id: "item-1", quantity: 5, rate: 76 }],
      },
    });
  });

  it("includes notes when provided", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimate: { estimate_id: "est-2", estimate_number: "EST-00002" },
    });

    await createEstimate("customer-1", [{ item_id: "item-1", quantity: 1, rate: 50 }], "Rush order");

    const call = mockZohoFetch.mock.calls[0];
    expect(call[1].body.notes).toBe("Rush order");
  });
});
```

- [ ] **Step 2: Implement createEstimate**

Add to `lib/zoho/books.ts` after the existing `getInvoicesForContact` function:

```typescript
export interface ZohoEstimate {
  estimate_id: string;
  estimate_number: string;
}

interface EstimateResponse {
  estimate: ZohoEstimate;
}

export async function createEstimate(
  customerId: string,
  lineItems: LineItem[],
  notes?: string,
): Promise<ZohoEstimate> {
  const body: Record<string, unknown> = {
    customer_id: customerId,
    line_items: lineItems,
  };

  if (notes !== undefined) {
    body.notes = notes;
  }

  const response = await zohoFetch<EstimateResponse>(
    "/books/v3/estimates",
    { method: "POST", body },
  );
  return response.estimate;
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/lib/zoho/books-estimate.test.ts`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add lib/zoho/books.ts __tests__/lib/zoho/books-estimate.test.ts
git commit -m "feat: add createEstimate to Zoho Books"
```

---

### Task 4: POST /api/portal/quote Route

**Files:**
- Create: `app/api/portal/quote/route.ts`
- Test: `__tests__/app/api/portal/quote.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/portal/quote.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEstimate } = vi.hoisted(() => ({ mockCreateEstimate: vi.fn() }));
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/books", () => ({ createEstimate: mockCreateEstimate }));
vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/portal/quote/route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/portal/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal/quote", () => {
  beforeEach(() => {
    mockCreateEstimate.mockReset().mockResolvedValue({
      estimate_id: "est-1",
      estimate_number: "EST-00001",
    });
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({ id: "u1", publicMetadata: {}, emailAddresses: [] });
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid data", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
      emailAddresses: [{ emailAddress: "test@store.com" }],
    });
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  it("creates estimate and sends email", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test Co" },
      emailAddresses: [{ emailAddress: "dealer@store.com" }],
    });
    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 5, price: 76 }],
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
    expect(mockCreateEstimate).toHaveBeenCalledWith("z1", [
      { item_id: "item-1", quantity: 5, rate: 76 },
    ], undefined);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
      emailAddresses: [{ emailAddress: "test@store.com" }],
    });
    const response = await POST(makeRequest({ items: [{ itemId: "i", quantity: 1, price: 1 }] }));
    expect(response.status).toBe(429);
  });
});
```

- [ ] **Step 2: Implement quote route**

Create `app/api/portal/quote/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { createEstimate } from "@/lib/zoho/books";
import { sendEmail } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";
import { quoteSchema } from "@/lib/schemas/quote";
import { formatPrice } from "@/lib/catalog/format";

export async function POST(request: Request): Promise<NextResponse> {
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

  const body = await request.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { zohoContactId, company } = user.publicMetadata;
  const { items, notes } = parsed.data;

  const lineItems = items.map((item) => ({
    item_id: item.itemId,
    quantity: item.quantity,
    rate: item.price,
  }));

  try {
    const estimate = await createEstimate(zohoContactId, lineItems, notes);
    const partnerEmail = user.emailAddresses[0]?.emailAddress;

    if (partnerEmail) {
      const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
      const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

      await sendEmail({
        to: partnerEmail,
        subject: `LOUISLUSO Quote Received — ${estimate.estimate_number}`,
        bcc: ["admin@louisluso.com"],
        body: [
          `Hi,`,
          "",
          `We've received your quote (${estimate.estimate_number}).`,
          "",
          `Company: ${company}`,
          `Items: ${itemCount} pieces`,
          `Subtotal: ${formatPrice(total)}`,
          "",
          "We'll review availability and confirm shortly.",
          "",
          "— The LOUISLUSO Team",
          "https://louisluso.com",
        ].join("\n"),
      });
    }

    return NextResponse.json({
      success: true,
      estimateNumber: estimate.estimate_number,
    });
  } catch {
    return NextResponse.json({ error: "Failed to submit quote" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/app/api/portal/quote.test.ts`
Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/quote/route.ts __tests__/app/api/portal/quote.test.ts
git commit -m "feat: add POST /api/portal/quote for Zoho Estimate"
```

---

### Task 5: CartProvider Context

**Files:**
- Create: `app/components/CartProvider.tsx`

- [ ] **Step 1: Create CartProvider**

Create `app/components/CartProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { loadCart, saveCart, addItems, updateQuantity, removeItem, clearCart, getTotalQuantity, getSubtotal, type CartItem } from "@/lib/portal/cart";

interface CartContextValue {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  add: (newItems: CartItem[]) => void;
  update: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(loadCart());
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    saveCart(newItems);
  }, []);

  const add = useCallback((newItems: CartItem[]) => {
    setItems((prev) => {
      const updated = addItems(prev, newItems);
      saveCart(updated);
      return updated;
    });
  }, []);

  const update = useCallback((itemId: string, quantity: number) => {
    setItems((prev) => {
      const updated = updateQuantity(prev, itemId, quantity);
      saveCart(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((itemId: string) => {
    setItems((prev) => {
      const updated = removeItem(prev, itemId);
      saveCart(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    const empty = clearCart();
    setItems(empty);
    saveCart(empty);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        totalQuantity: getTotalQuantity(items),
        subtotal: getSubtotal(items),
        add,
        update,
        remove,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/CartProvider.tsx
git commit -m "feat: add CartProvider context with localStorage persistence"
```

---

### Task 6: CartIcon Component

**Files:**
- Create: `app/components/CartIcon.tsx`
- Test: `__tests__/app/components/CartIcon.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/CartIcon.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartIcon } from "@/app/components/CartIcon";

vi.mock("@/app/components/CartProvider", () => ({
  useCart: () => ({ totalQuantity: 3 }),
}));

describe("CartIcon", () => {
  it("renders shopping bag icon", () => {
    render(<CartIcon />);
    expect(screen.getByRole("link", { name: /quote/i })).toBeDefined();
  });

  it("shows count badge when items in cart", () => {
    render(<CartIcon />);
    expect(screen.getByText("3")).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement CartIcon**

Create `app/components/CartIcon.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";

export function CartIcon(): React.ReactElement {
  const { totalQuantity } = useCart();

  return (
    <Link href="/portal/quote" aria-label="View quote" className="relative text-gray-500 transition-colors hover:text-bronze">
      <ShoppingBagIcon className="h-5 w-5" />
      {totalQuantity > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bronze px-1 text-[10px] font-bold text-white">
          {totalQuantity}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/app/components/CartIcon.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/components/CartIcon.tsx __tests__/app/components/CartIcon.test.tsx
git commit -m "feat: add CartIcon with count badge"
```

---

### Task 7: Navigation Update — Remove Heart, Add CartIcon

**Files:**
- Modify: `app/components/Navigation.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update Navigation.tsx**

Remove the `HeartIcon` import and the heart link. Add `CartIcon` for partners.

Remove this import:
```tsx
import { HeartIcon } from "@heroicons/react/24/outline";
```

Replace the right utility links section:

```tsx
{/* Right: utility links (desktop) */}
<div className="hidden items-center gap-6 lg:flex">
  <Link href="/find-a-dealer" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Find a Dealer</Link>
  {partner ? (
    <>
      <CartIcon />
      <UserMenu />
    </>
  ) : (
    <Link href="/portal" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Login</Link>
  )}
</div>
```

Add import at top:
```tsx
import { CartIcon } from "./CartIcon";
```

- [ ] **Step 2: Wrap app in CartProvider**

Edit `app/layout.tsx` — wrap children in CartProvider:

```tsx
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { heading, body } from '@/lib/fonts';
import { Navigation } from '@/app/components/Navigation';
import { Footer } from '@/app/components/Footer';
import { CartProvider } from '@/app/components/CartProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'LOUISLUSO — Premium Eyewear',
  description: "The World's Lightest Frames",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <ClerkProvider>
          <CartProvider>
            <Navigation />
            {children}
            <Footer />
          </CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Navigation.tsx app/layout.tsx
git commit -m "feat: add CartIcon to nav, remove heart, wrap app in CartProvider"
```

---

### Task 8: VariantQuoteTable Component

**Files:**
- Create: `app/components/VariantQuoteTable.tsx`
- Test: `__tests__/app/components/VariantQuoteTable.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/VariantQuoteTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariantQuoteTable } from "@/app/components/VariantQuoteTable";
import type { CatalogVariant } from "@/lib/catalog/types";

const mockAdd = vi.fn();
vi.mock("@/app/components/CartProvider", () => ({
  useCart: () => ({ add: mockAdd, items: [] }),
}));

const variants: CatalogVariant[] = [
  { id: "v1", colorCode: "C1", colorName: "Black Glossed", inStock: true, image: null },
  { id: "v2", colorCode: "C2", colorName: "Black Matte", inStock: true, image: null },
  { id: "v3", colorCode: "C3", colorName: "Brown", inStock: false, image: null },
];

describe("VariantQuoteTable", () => {
  it("renders all variants with color names", () => {
    render(<VariantQuoteTable variants={variants} productId="g1" productName="SG-1011" price={76} />);
    expect(screen.getByText("Black Glossed")).toBeDefined();
    expect(screen.getByText("Black Matte")).toBeDefined();
    expect(screen.getByText("Brown")).toBeDefined();
  });

  it("disables quantity input for OOS variants", () => {
    render(<VariantQuoteTable variants={variants} productId="g1" productName="SG-1011" price={76} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[2]).toBeDisabled();
  });

  it("shows Out of Stock label for OOS variants", () => {
    render(<VariantQuoteTable variants={variants} productId="g1" productName="SG-1011" price={76} />);
    expect(screen.getByText("Out of Stock")).toBeDefined();
  });

  it("Add to Quote button disabled when all quantities are 0", () => {
    render(<VariantQuoteTable variants={variants} productId="g1" productName="SG-1011" price={76} />);
    expect(screen.getByRole("button", { name: /add to quote/i })).toBeDisabled();
  });

  it("calls cart.add when Add to Quote clicked with quantities", async () => {
    render(<VariantQuoteTable variants={variants} productId="g1" productName="SG-1011" price={76} />);
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "5");
    await userEvent.click(screen.getByRole("button", { name: /add to quote/i }));
    expect(mockAdd).toHaveBeenCalledWith([
      expect.objectContaining({ itemId: "v1", quantity: 5, price: 76 }),
    ]);
  });
});
```

- [ ] **Step 2: Implement VariantQuoteTable**

Create `app/components/VariantQuoteTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { CatalogVariant } from "@/lib/catalog/types";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/catalog/format";
import type { CartItem } from "@/lib/portal/cart";

interface VariantQuoteTableProps {
  variants: CatalogVariant[];
  productId: string;
  productName: string;
  price: number;
}

export function VariantQuoteTable({ variants, productId, productName, price }: VariantQuoteTableProps): React.ReactElement {
  const { add } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);

  function setQty(variantId: string, qty: number): void {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, qty) }));
  }

  const hasItems = Object.values(quantities).some((q) => q > 0);

  function handleAdd(): void {
    const items: CartItem[] = [];
    for (const variant of variants) {
      const qty = quantities[variant.id] ?? 0;
      if (qty > 0) {
        items.push({
          itemId: variant.id,
          productId,
          productName,
          colorName: variant.colorName,
          quantity: qty,
          price,
        });
      }
    }
    if (items.length > 0) {
      add(items);
      setQuantities({});
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Order by Variant
      </h3>
      <div className="mt-3 space-y-2">
        {variants.map((variant) => {
          const qty = quantities[variant.id] ?? 0;
          const lineTotal = qty * price;
          return (
            <div key={variant.id} className="flex items-center gap-4 text-sm">
              <span className="w-40 truncate">{variant.colorName}</span>
              {variant.inStock ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty(variant.id, parseInt(e.target.value) || 0)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                    role="spinbutton"
                  />
                  {lineTotal > 0 && (
                    <span className="text-xs text-gray-500">{formatPrice(lineTotal)}</span>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-400">Out of Stock</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleAdd}
        disabled={!hasItems}
        className="mt-6 w-full border border-bronze bg-bronze px-8 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {added ? "Added!" : "Add to Quote"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- __tests__/app/components/VariantQuoteTable.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/components/VariantQuoteTable.tsx __tests__/app/components/VariantQuoteTable.test.tsx
git commit -m "feat: add VariantQuoteTable for per-variant ordering"
```

---

### Task 9: Product Detail — Show VariantQuoteTable for Partners

**Files:**
- Modify: `app/products/[slug]/page.tsx`

- [ ] **Step 1: Update product detail page**

Edit `app/products/[slug]/page.tsx`:

Add import:
```tsx
import { VariantQuoteTable } from "@/app/components/VariantQuoteTable";
```

Replace the `<VariantSelector>` usage with conditional rendering:

```tsx
{partner ? (
  <VariantQuoteTable
    variants={product.variants}
    productId={product.id}
    productName={product.name}
    price={product.listingPrice}
  />
) : (
  <VariantSelector
    variants={product.variants}
    productName={product.name}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add "app/products/[slug]/page.tsx"
git commit -m "feat: show VariantQuoteTable for partners on product detail"
```

---

### Task 10: Quote Page

**Files:**
- Create: `app/portal/quote/page.tsx`

- [ ] **Step 1: Create quote page**

Create `app/portal/quote/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/components/CartProvider";
import { formatPrice } from "@/lib/catalog/format";

export default function QuotePage(): React.ReactElement {
  const { items, subtotal, totalQuantity, update, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/portal/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit quote");
        return;
      }

      setSubmitted(data.estimateNumber);
      clear();
    } catch {
      setError("Unable to submit quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-3xl text-white">Quote Submitted</h1>
          <p className="mt-4 text-sm text-gray-400">
            Your quote ({submitted}) has been received. We&apos;ll review availability and confirm shortly.
          </p>
          <Link
            href="/eyeglasses"
            className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-3xl text-white">Your Quote</h1>
          <p className="mt-4 text-sm text-gray-400">
            Your quote is empty. Browse our collections to get started.
          </p>
          <Link
            href="/eyeglasses"
            className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">Your Quote</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalQuantity} item{totalQuantity !== 1 ? "s" : ""} &middot; {formatPrice(subtotal)}
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
                <th className="pb-3">Product</th>
                <th className="pb-3">Color</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.itemId} className="border-b border-white/5">
                  <td className="py-3 text-gray-200">{item.productName}</td>
                  <td className="py-3 text-gray-400">{item.colorName}</td>
                  <td className="py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        if (qty <= 0) remove(item.itemId);
                        else update(item.itemId, qty);
                      }}
                      className="w-16 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-gray-200 outline-none focus:border-bronze"
                    />
                  </td>
                  <td className="py-3 text-right text-gray-400">{formatPrice(item.price)}</td>
                  <td className="py-3 text-right text-gray-200">{formatPrice(item.quantity * item.price)}</td>
                  <td className="py-3 pl-4 text-right">
                    <button
                      onClick={() => remove(item.itemId)}
                      className="text-gray-600 transition-colors hover:text-red-400"
                      aria-label={`Remove ${item.productName} ${item.colorName}`}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex gap-4">
            <Link href="/eyeglasses" className="text-xs text-bronze hover:underline">
              Continue Shopping
            </Link>
            <button onClick={clear} className="text-xs text-gray-500 hover:text-red-400">
              Clear All
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-400">Subtotal</p>
            <p className="text-xl font-semibold text-white">{formatPrice(subtotal)}</p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 rounded bg-bronze px-8 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Quote"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/portal/quote/page.tsx
git commit -m "feat: add quote review/edit page with submission"
```

---

### Task 11: Full Test Suite + Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds, `/portal/quote` page included

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address Phase 5c build/test issues"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```
