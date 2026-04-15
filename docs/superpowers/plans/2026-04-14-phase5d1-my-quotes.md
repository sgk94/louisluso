# Phase 5d.1: My Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partners can view a paginated list of their submitted quotes (Zoho Estimates) at `/portal/quotes`, and after submitting a quote they land on a dedicated success page showing the full line-item breakdown.

**Architecture:** Two new server-rendered pages under `/portal`. Data comes from Zoho Books Estimates API, wrapped in `unstable_cache` (60s TTL) with a static tag. Per-user Upstash rate limit. 5c's submit flow is refactored to redirect to the success page and invalidate the cache tag.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Zod validation, Upstash Redis rate limit, Clerk auth, Zoho Books Estimates API, Vitest + React Testing Library.

Spec reference: `docs/superpowers/specs/2026-04-14-phase5d1-my-quotes-design.md`

---

## File Structure

### New files
- `app/portal/quotes/page.tsx` — list page (Server Component)
- `app/portal/quotes/QuotesTable.tsx` — presentational table
- `app/portal/quote/success/[estimateNumber]/page.tsx` — submit success page (Server Component)
- `__tests__/app/portal/QuotesTable.test.tsx` — presentational table tests
- `__tests__/app/portal/quote-success.test.tsx` — success-page data-layer tests
- `__tests__/lib/zoho/books-estimates-list.test.ts` — `getEstimatesForContact` + status mapper
- `__tests__/lib/zoho/books-estimate-by-number.test.ts` — `getEstimateByNumber`

### Modified files
- `lib/zoho/books.ts` — add list/detail helpers, cache wrapper, status mapper
- `lib/rate-limit.ts` — add `rateLimitQuotesList`
- `app/portal/page.tsx` — enable "My Quotes" dashboard card
- `app/components/UserMenu.tsx` — add "My Quotes" link above Account
- `app/portal/quote/page.tsx` — redirect to success page on submit
- `app/api/portal/quote/route.ts` — call `revalidateTag` after `createEstimate`
- `__tests__/app/api/portal/quote.test.ts` — assert revalidateTag behavior

---

### Task 1: Rate limiter — add `rateLimitQuotesList`

**Files:**
- Modify: `lib/rate-limit.ts`

- [ ] **Step 1: Write the failing test**

Add a new test file `__tests__/lib/rate-limit-quotes-list.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLimit } = vi.hoisted(() => ({ mockLimit: vi.fn() }));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn(() => "sliding-window-config");
    limit = mockLimit;
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: { UPSTASH_REDIS_REST_URL: "http://redis", UPSTASH_REDIS_REST_TOKEN: "token" },
}));

import { rateLimitQuotesList } from "@/lib/rate-limit";

describe("rateLimitQuotesList", () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it("returns success true when limit not exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 29 });
    const result = await rateLimitQuotesList("user-abc");
    expect(result).toEqual({ success: true, remaining: 29 });
    expect(mockLimit).toHaveBeenCalledWith("user-abc");
  });

  it("returns success false when limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    const result = await rateLimitQuotesList("user-abc");
    expect(result).toEqual({ success: false, remaining: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/lib/rate-limit-quotes-list.test.ts`
Expected: FAIL with `rateLimitQuotesList is not a function` or similar.

- [ ] **Step 3: Add the implementation**

Append to `lib/rate-limit.ts`:

```typescript
const quotesListLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "5 m"),
  prefix: "louisluso:quotes-list",
});

export async function rateLimitQuotesList(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await quotesListLimiter.limit(identifier);
  return { success, remaining };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/lib/rate-limit-quotes-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts __tests__/lib/rate-limit-quotes-list.test.ts
git commit -m "feat: add rateLimitQuotesList — 30 req / 5 min per user"
```

---

### Task 2: Zoho data layer — status mapper + list interfaces

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: `__tests__/lib/zoho/books-estimates-list.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/books-estimates-list.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { partnerLabelForEstimateStatus } from "@/lib/zoho/books";

describe("partnerLabelForEstimateStatus", () => {
  it("maps draft to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("draft")).toBe("Pending Review");
  });

  it("maps sent to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("sent")).toBe("Pending Review");
  });

  it("maps accepted to Confirmed", () => {
    expect(partnerLabelForEstimateStatus("accepted")).toBe("Confirmed");
  });

  it("maps declined to Declined", () => {
    expect(partnerLabelForEstimateStatus("declined")).toBe("Declined");
  });

  it("maps expired to Expired", () => {
    expect(partnerLabelForEstimateStatus("expired")).toBe("Expired");
  });

  it("maps invoiced to Order Placed", () => {
    expect(partnerLabelForEstimateStatus("invoiced")).toBe("Order Placed");
  });

  it("title-cases unknown statuses as fallback", () => {
    expect(partnerLabelForEstimateStatus("on_hold")).toBe("On_hold");
    expect(partnerLabelForEstimateStatus("")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/lib/zoho/books-estimates-list.test.ts`
Expected: FAIL — `partnerLabelForEstimateStatus` does not exist.

- [ ] **Step 3: Add interfaces + mapper to `lib/zoho/books.ts`**

Append to `lib/zoho/books.ts`:

```typescript
export interface ZohoEstimateListItem {
  estimate_id: string;
  estimate_number: string;
  date: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  total: number;
  currency_code: string;
}

export interface EstimateListOptions {
  page?: number;
  perPage?: number;
}

export interface EstimateListResult {
  estimates: ZohoEstimateListItem[];
  page: number;
  hasMore: boolean;
}

const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "Pending Review",
  sent: "Pending Review",
  accepted: "Confirmed",
  declined: "Declined",
  expired: "Expired",
  invoiced: "Order Placed",
};

export function partnerLabelForEstimateStatus(status: string): string {
  if (Object.prototype.hasOwnProperty.call(ESTIMATE_STATUS_LABELS, status)) {
    return ESTIMATE_STATUS_LABELS[status];
  }
  if (status.length === 0) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/lib/zoho/books-estimates-list.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/lib/zoho/books-estimates-list.test.ts
git commit -m "feat: add estimate list types + partnerLabelForEstimateStatus"
```

---

### Task 3: `getEstimatesForContact` — paginated Zoho fetch

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: `__tests__/lib/zoho/books-estimates-list.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/zoho/books-estimates-list.test.ts` (above the top of the file, modify imports):

Replace the whole file contents with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import {
  getEstimatesForContact,
  partnerLabelForEstimateStatus,
} from "@/lib/zoho/books";

describe("partnerLabelForEstimateStatus", () => {
  it("maps draft to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("draft")).toBe("Pending Review");
  });
  it("maps sent to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("sent")).toBe("Pending Review");
  });
  it("maps accepted to Confirmed", () => {
    expect(partnerLabelForEstimateStatus("accepted")).toBe("Confirmed");
  });
  it("maps declined to Declined", () => {
    expect(partnerLabelForEstimateStatus("declined")).toBe("Declined");
  });
  it("maps expired to Expired", () => {
    expect(partnerLabelForEstimateStatus("expired")).toBe("Expired");
  });
  it("maps invoiced to Order Placed", () => {
    expect(partnerLabelForEstimateStatus("invoiced")).toBe("Order Placed");
  });
  it("title-cases unknown statuses as fallback", () => {
    expect(partnerLabelForEstimateStatus("on_hold")).toBe("On_hold");
    expect(partnerLabelForEstimateStatus("")).toBe("");
  });
});

describe("getEstimatesForContact", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  const sampleEstimate = {
    estimate_id: "est-1",
    estimate_number: "EST-00001",
    date: "2026-04-12",
    status: "sent",
    total: 1140,
    currency_code: "USD",
  };

  it("passes correct params with defaults (page=1, per_page=20)", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
      page_context: { has_more_page: false },
    });

    await getEstimatesForContact("cust-1");

    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      params: {
        customer_id: "cust-1",
        sort_column: "date",
        sort_order: "D",
        page: "1",
        per_page: "20",
      },
    });
  });

  it("passes custom page + perPage", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [],
      page_context: { has_more_page: false },
    });

    await getEstimatesForContact("cust-1", { page: 3, perPage: 50 });

    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      params: {
        customer_id: "cust-1",
        sort_column: "date",
        sort_order: "D",
        page: "3",
        per_page: "50",
      },
    });
  });

  it("returns estimates, page, and hasMore", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
      page_context: { has_more_page: true },
    });

    const result = await getEstimatesForContact("cust-1", { page: 2 });
    expect(result.estimates).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it("defaults hasMore to false when page_context is missing", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
    });
    const result = await getEstimatesForContact("cust-1");
    expect(result.hasMore).toBe(false);
  });

  it("includes draft rows without filtering", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [{ ...sampleEstimate, status: "draft" }],
      page_context: { has_more_page: false },
    });
    const result = await getEstimatesForContact("cust-1");
    expect(result.estimates).toHaveLength(1);
    expect(result.estimates[0].status).toBe("draft");
  });

  it("throws on malformed Zoho response", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [{ estimate_id: "missing-fields" }],
    });
    await expect(getEstimatesForContact("cust-1")).rejects.toThrow();
  });

  it("propagates Zoho errors", async () => {
    mockZohoFetch.mockRejectedValueOnce(new Error("Zoho 500"));
    await expect(getEstimatesForContact("cust-1")).rejects.toThrow("Zoho 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/lib/zoho/books-estimates-list.test.ts`
Expected: FAIL — `getEstimatesForContact` does not exist.

- [ ] **Step 3: Implement `getEstimatesForContact`**

Add to the top of `lib/zoho/books.ts` (below existing imports):

```typescript
import { z } from "zod";
```

If `z` is already imported, skip. Then add near the other type definitions:

```typescript
const estimateListItemSchema = z.object({
  estimate_id: z.string(),
  estimate_number: z.string(),
  date: z.string(),
  status: z.string(),
  total: z.number(),
  currency_code: z.string(),
});

const estimatesListResponseSchema = z.object({
  estimates: z.array(estimateListItemSchema),
  page_context: z
    .object({
      has_more_page: z.boolean().optional(),
    })
    .optional(),
});
```

Then append the function:

```typescript
export async function getEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 20;

  const response = await zohoFetch<unknown>("/books/v3/estimates", {
    params: {
      customer_id: customerId,
      sort_column: "date",
      sort_order: "D",
      page: String(page),
      per_page: String(perPage),
    },
  });

  const parsed = estimatesListResponseSchema.parse(response);

  return {
    estimates: parsed.estimates as ZohoEstimateListItem[],
    page,
    hasMore: parsed.page_context?.has_more_page ?? false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/lib/zoho/books-estimates-list.test.ts`
Expected: PASS (all 14 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/lib/zoho/books-estimates-list.test.ts
git commit -m "feat: add getEstimatesForContact with Zod validation + pagination"
```

---

### Task 4: `getCachedEstimatesForContact` — unstable_cache wrapper

**Files:**
- Modify: `lib/zoho/books.ts`

- [ ] **Step 1: Add wrapper**

Append to `lib/zoho/books.ts`:

```typescript
import { unstable_cache } from "next/cache";

export const ESTIMATES_LIST_CACHE_TAG = "zoho-estimates-list";

const cachedGetEstimatesForContact = unstable_cache(
  async (customerId: string, page: number, perPage: number) => {
    return getEstimatesForContact(customerId, { page, perPage });
  },
  ["zoho-estimates-list"],
  {
    tags: [ESTIMATES_LIST_CACHE_TAG],
    revalidate: 60,
  },
);

export function getCachedEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult> {
  return cachedGetEstimatesForContact(
    customerId,
    options?.page ?? 1,
    options?.perPage ?? 20,
  );
}
```

Note: if `unstable_cache` is already imported elsewhere in the file, do not duplicate the import.

- [ ] **Step 2: Verify the type checker is happy**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/zoho/books.ts
git commit -m "feat: add getCachedEstimatesForContact with 60s TTL"
```

No dedicated unit test for the cache wrapper — `unstable_cache` is hard to mock meaningfully in a unit test without an integration environment. The wrapped function is already tested in Task 3; cache behavior is verified by manual smoke test in Task 13 and by the `revalidateTag` integration test in Task 12.

---

### Task 5: `getEstimateByNumber` — detail fetch for success page

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: `__tests__/lib/zoho/books-estimate-by-number.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/zoho/books-estimate-by-number.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import { getEstimateByNumber } from "@/lib/zoho/books";

const DETAIL = {
  estimate_id: "est-42",
  estimate_number: "EST-00042",
  customer_id: "cust-1",
  date: "2026-04-12",
  status: "sent",
  total: 1383,
  sub_total: 1383,
  currency_code: "USD",
  line_items: [
    {
      line_item_id: "li-1",
      item_id: "item-1",
      name: "SG-1011",
      sku: "SG-1011-C1",
      quantity: 5,
      rate: 76,
      item_total: 380,
    },
  ],
};

describe("getEstimateByNumber", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("happy path: returns detail with line items", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: DETAIL });

    const result = await getEstimateByNumber("cust-1", "EST-00042");

    expect(result).not.toBeNull();
    expect(result?.estimate_number).toBe("EST-00042");
    expect(result?.line_items).toHaveLength(1);
    expect(result?.line_items[0].name).toBe("SG-1011");

    expect(mockZohoFetch).toHaveBeenNthCalledWith(1, "/books/v3/estimates", {
      params: { customer_id: "cust-1", estimate_number: "EST-00042" },
    });
    expect(mockZohoFetch).toHaveBeenNthCalledWith(2, "/books/v3/estimates/est-42");
  });

  it("returns null when filtered list is empty", async () => {
    mockZohoFetch.mockResolvedValueOnce({ estimates: [] });
    const result = await getEstimateByNumber("cust-1", "EST-99999");
    expect(result).toBeNull();
    expect(mockZohoFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when customer_id on returned detail does not match caller", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: { ...DETAIL, customer_id: "other-cust" } });

    const result = await getEstimateByNumber("cust-1", "EST-00042");
    expect(result).toBeNull();
  });

  it("throws on malformed detail response", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: { estimate_id: "bad", estimate_number: "BAD" } });

    await expect(getEstimateByNumber("cust-1", "EST-00042")).rejects.toThrow();
  });

  it("propagates Zoho errors", async () => {
    mockZohoFetch.mockRejectedValueOnce(new Error("Zoho 500"));
    await expect(getEstimateByNumber("cust-1", "EST-00042")).rejects.toThrow("Zoho 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/lib/zoho/books-estimate-by-number.test.ts`
Expected: FAIL — `getEstimateByNumber` does not exist.

- [ ] **Step 3: Implement `getEstimateByNumber`**

Append to `lib/zoho/books.ts`:

```typescript
const estimateDetailLineItemSchema = z.object({
  line_item_id: z.string(),
  item_id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number(),
  rate: z.number(),
  item_total: z.number(),
});

const estimateDetailSchema = z.object({
  estimate_id: z.string(),
  estimate_number: z.string(),
  customer_id: z.string(),
  date: z.string(),
  status: z.string(),
  total: z.number(),
  sub_total: z.number(),
  currency_code: z.string(),
  line_items: z.array(estimateDetailLineItemSchema),
});

const estimateDetailResponseSchema = z.object({
  estimate: estimateDetailSchema,
});

const estimateSearchResponseSchema = z.object({
  estimates: z.array(
    z.object({
      estimate_id: z.string(),
      estimate_number: z.string(),
      customer_id: z.string(),
    }),
  ),
});

export interface ZohoEstimateDetail {
  estimate_id: string;
  estimate_number: string;
  customer_id: string;
  date: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  total: number;
  sub_total: number;
  currency_code: string;
  line_items: Array<{
    line_item_id: string;
    item_id: string;
    name: string;
    sku?: string;
    description?: string;
    quantity: number;
    rate: number;
    item_total: number;
  }>;
}

export async function getEstimateByNumber(
  customerId: string,
  estimateNumber: string,
): Promise<ZohoEstimateDetail | null> {
  const searchResponse = await zohoFetch<unknown>("/books/v3/estimates", {
    params: {
      customer_id: customerId,
      estimate_number: estimateNumber,
    },
  });
  const searchParsed = estimateSearchResponseSchema.parse(searchResponse);
  const match = searchParsed.estimates.find(
    (e) => e.estimate_number === estimateNumber && e.customer_id === customerId,
  );
  if (!match) return null;

  const detailResponse = await zohoFetch<unknown>(
    `/books/v3/estimates/${match.estimate_id}`,
  );
  const detailParsed = estimateDetailResponseSchema.parse(detailResponse);

  if (detailParsed.estimate.customer_id !== customerId) return null;

  return detailParsed.estimate as ZohoEstimateDetail;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/lib/zoho/books-estimate-by-number.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/lib/zoho/books-estimate-by-number.test.ts
git commit -m "feat: add getEstimateByNumber with cross-partner isolation"
```

---

### Task 6: `QuotesTable` presentational component

**Files:**
- Create: `app/portal/quotes/QuotesTable.tsx`
- Test: `__tests__/app/portal/QuotesTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/portal/QuotesTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuotesTable } from "@/app/portal/quotes/QuotesTable";
import type { ZohoEstimateListItem } from "@/lib/zoho/books";

const SAMPLES: ZohoEstimateListItem[] = [
  {
    estimate_id: "e1",
    estimate_number: "EST-00003",
    date: "2026-04-12",
    status: "sent",
    total: 1140,
    currency_code: "USD",
  },
  {
    estimate_id: "e2",
    estimate_number: "EST-00002",
    date: "2026-04-08",
    status: "accepted",
    total: 760,
    currency_code: "USD",
  },
  {
    estimate_id: "e3",
    estimate_number: "EST-00001",
    date: "2026-03-28",
    status: "invoiced",
    total: 2420,
    currency_code: "USD",
  },
];

describe("QuotesTable", () => {
  it("renders each estimate's number, formatted date, status label, and total", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={false} />);

    expect(screen.getByText("EST-00003")).toBeInTheDocument();
    expect(screen.getByText("EST-00002")).toBeInTheDocument();
    expect(screen.getByText("EST-00001")).toBeInTheDocument();

    // draft/sent both map to "Pending Review" — one instance for this sample
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Order Placed")).toBeInTheDocument();

    expect(screen.getByText("Apr 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("$1,140")).toBeInTheDocument();
    expect(screen.getByText("$760")).toBeInTheDocument();
    expect(screen.getByText("$2,420")).toBeInTheDocument();
  });

  it("applies bronze class to Confirmed pill", () => {
    const { container } = render(
      <QuotesTable estimates={SAMPLES} page={1} hasMore={false} />,
    );
    const confirmedPill = container.querySelector("span.text-bronze");
    expect(confirmedPill).not.toBeNull();
    expect(confirmedPill?.textContent).toBe("Confirmed");
  });

  it("hides pagination controls on single-page result", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={false} />);
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("renders Next only on page 1 with more pages", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={true} />);
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.getByText(/Next/)).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("renders both Previous and Next on middle page", () => {
    render(<QuotesTable estimates={SAMPLES} page={3} hasMore={true} />);
    const prev = screen.getByText(/Previous/);
    const next = screen.getByText(/Next/);
    expect(prev).toBeInTheDocument();
    expect(next).toBeInTheDocument();
    expect(prev.closest("a")?.getAttribute("href")).toBe("/portal/quotes?page=2");
    expect(next.closest("a")?.getAttribute("href")).toBe("/portal/quotes?page=4");
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("renders only Previous on last page", () => {
    render(<QuotesTable estimates={SAMPLES} page={4} hasMore={false} />);
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/app/portal/QuotesTable.test.tsx`
Expected: FAIL — `QuotesTable` module not found.

- [ ] **Step 3: Create `app/portal/quotes/QuotesTable.tsx`**

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/catalog/format";
import {
  partnerLabelForEstimateStatus,
  type ZohoEstimateListItem,
} from "@/lib/zoho/books";

interface Props {
  estimates: ZohoEstimateListItem[];
  page: number;
  hasMore: boolean;
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  "Pending Review": "bg-white/5 text-gray-300",
  Confirmed: "bg-bronze/15 text-bronze",
  "Order Placed": "bg-green-500/15 text-green-400",
  Declined: "bg-red-500/10 text-red-400",
  Expired: "bg-white/5 text-gray-500",
};

function pillClass(label: string): string {
  return STATUS_PILL_CLASSES[label] ?? "bg-white/5 text-gray-500";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function QuotesTable({
  estimates,
  page,
  hasMore,
}: Props): React.ReactElement {
  const showPagination = !(page === 1 && !hasMore);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
            <th className="pb-3">Quote #</th>
            <th className="pb-3">Date</th>
            <th className="pb-3">Status</th>
            <th className="pb-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((e) => {
            const label = partnerLabelForEstimateStatus(e.status);
            return (
              <tr key={e.estimate_id} className="border-b border-white/5">
                <td className="py-3 text-gray-200">{e.estimate_number}</td>
                <td className="py-3 text-gray-400">{formatDate(e.date)}</td>
                <td className="py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${pillClass(label)}`}
                  >
                    {label}
                  </span>
                </td>
                <td className="py-3 text-right text-gray-200">
                  {formatPrice(e.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-400">
          {page > 1 && (
            <Link
              href={`/portal/quotes?page=${page - 1}`}
              className="hover:text-bronze"
            >
              ← Previous
            </Link>
          )}
          <span className="text-gray-500">Page {page}</span>
          {hasMore && (
            <Link
              href={`/portal/quotes?page=${page + 1}`}
              className="hover:text-bronze"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/app/portal/QuotesTable.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/portal/quotes/QuotesTable.tsx __tests__/app/portal/QuotesTable.test.tsx
git commit -m "feat: add QuotesTable presentational component with pagination"
```

---

### Task 7: `/portal/quotes` list page

**Files:**
- Create: `app/portal/quotes/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/portal/quotes/page.tsx`:

```tsx
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { isPartner } from "@/lib/portal/types";
import { rateLimitQuotesList } from "@/lib/rate-limit";
import { getCachedEstimatesForContact } from "@/lib/zoho/books";
import { QuotesTable } from "./QuotesTable";

export const metadata = {
  title: "My Quotes | LOUISLUSO",
};

function parsePage(raw: string | undefined | string[]): number {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(val ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  // Portal layout has already enforced auth + partner. user is guaranteed non-null and partner.
  const meta = isPartner(user!.publicMetadata) ? user!.publicMetadata : null;

  if (!meta?.zohoContactId) {
    return (
      <ErrorShell message="Account setup incomplete, contact support." />
    );
  }

  const { success } = await rateLimitQuotesList(user!.id);
  if (!success) {
    return (
      <ErrorShell message="Too many requests. Please wait a moment and refresh." />
    );
  }

  const params = await searchParams;
  const page = parsePage(params.page);

  let data;
  try {
    data = await getCachedEstimatesForContact(meta.zohoContactId, {
      page,
      perPage: 20,
    });
  } catch (err) {
    console.error(
      `Failed to fetch quotes for ${meta.zohoContactId}:`,
      err,
    );
    return (
      <ErrorShell message="Unable to load quotes right now. Please try again in a moment." />
    );
  }

  // Past-end empty: user typed ?page=50 with only 5 quotes
  if (page > 1 && data.estimates.length === 0) {
    return (
      <PageShell>
        <p className="text-sm text-gray-400">No quotes on this page.</p>
        <Link
          href="/portal/quotes"
          className="mt-4 inline-block text-xs text-bronze hover:underline"
        >
          Back to page 1
        </Link>
      </PageShell>
    );
  }

  // First-time empty
  if (page === 1 && data.estimates.length === 0) {
    return (
      <PageShell>
        <p className="text-sm text-gray-400">
          You haven&apos;t submitted any quotes yet.
        </p>
        <Link
          href="/eyeglasses"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          Browse Collections
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <QuotesTable
        estimates={data.estimates}
        page={data.page}
        hasMore={data.hasMore}
      />
    </PageShell>
  );
}

function PageShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">My Quotes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review your submitted quotes and orders
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

function ErrorShell({ message }: { message: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <p className="max-w-md text-center text-sm text-gray-400">{message}</p>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: `/portal/quotes` appears in the route list, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/portal/quotes/page.tsx
git commit -m "feat: add /portal/quotes list page (Server Component)"
```

---

### Task 8: Enable "My Quotes" dashboard card

**Files:**
- Modify: `app/portal/page.tsx`

- [ ] **Step 1: Update the card**

Replace the `cards` array in `app/portal/page.tsx`:

```typescript
  const cards = [
    {
      title: "Browse Catalog",
      description: "View our collections with your pricing",
      href: "/eyeglasses",
      enabled: true,
    },
    {
      title: "My Quotes",
      description: "Review submitted quotes and their status",
      href: "/portal/quotes",
      enabled: true,
    },
    {
      title: "Account Settings",
      description: "View your account details",
      href: "/portal/account",
      enabled: true,
    },
  ];
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/portal/page.tsx
git commit -m "feat: enable My Quotes dashboard card"
```

---

### Task 9: Add "My Quotes" to UserMenu

**Files:**
- Modify: `app/components/UserMenu.tsx`
- Test: `__tests__/app/components/UserMenu.test.tsx`

- [ ] **Step 1: Update the failing test**

Open `__tests__/app/components/UserMenu.test.tsx` and add a new `it` block (exact location — after any existing tests):

```tsx
  it("renders the My Quotes link above Account", () => {
    render(<UserMenu />);
    // Open the menu
    fireEvent.click(screen.getByLabelText("Account menu"));
    const myQuotes = screen.getByText("My Quotes");
    expect(myQuotes).toBeInTheDocument();
    expect(myQuotes.closest("a")?.getAttribute("href")).toBe("/portal/quotes");
  });
```

Make sure `fireEvent` is imported from `@testing-library/react` — add to the existing imports at top of the test file if missing.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/app/components/UserMenu.test.tsx`
Expected: FAIL — "My Quotes" text not found.

- [ ] **Step 3: Update `app/components/UserMenu.tsx`**

Replace the `MENU_ITEMS` array:

```typescript
const MENU_ITEMS = [
  { label: "Dashboard", href: "/portal", enabled: true },
  { label: "My Quotes", href: "/portal/quotes", enabled: true },
  { label: "Orders", href: "/portal/orders", enabled: false },
  { label: "Favorites", href: "/portal/favorites", enabled: false },
  { label: "Account", href: "/portal/account", enabled: true },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/app/components/UserMenu.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/UserMenu.tsx __tests__/app/components/UserMenu.test.tsx
git commit -m "feat: add My Quotes to UserMenu dropdown"
```

---

### Task 10: Quote success page — `/portal/quote/success/[estimateNumber]`

**Files:**
- Create: `app/portal/quote/success/[estimateNumber]/page.tsx`
- Test: `__tests__/app/portal/quote-success.test.tsx`

This task has two parts: page implementation + integration-style test that exercises the page's data branches.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/portal/quote-success.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));
const { mockGetEstimateByNumber } = vi.hoisted(() => ({
  mockGetEstimateByNumber: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("@/lib/zoho/books", async () => {
  const actual: Record<string, unknown> = await vi.importActual("@/lib/zoho/books");
  return {
    ...actual,
    getEstimateByNumber: mockGetEstimateByNumber,
  };
});

import QuoteSuccessPage from "@/app/portal/quote/success/[estimateNumber]/page";

const PARTNER = {
  id: "u1",
  publicMetadata: { role: "partner", zohoContactId: "cust-1", company: "Test Co" },
};

const PARTNER_NO_ZOHO = {
  id: "u1",
  publicMetadata: { role: "partner", company: "Test Co" },
};

const ESTIMATE = {
  estimate_id: "est-42",
  estimate_number: "EST-00042",
  customer_id: "cust-1",
  date: "2026-04-12",
  status: "sent" as const,
  total: 1383,
  sub_total: 1383,
  currency_code: "USD",
  line_items: [
    {
      line_item_id: "li-1",
      item_id: "item-1",
      name: "SG-1011",
      sku: "SG-1011-C1",
      quantity: 5,
      rate: 76,
      item_total: 380,
    },
    {
      line_item_id: "li-2",
      item_id: "item-2",
      name: "LC-9018",
      sku: "LC-9018-C1",
      quantity: 3,
      rate: 81,
      item_total: 243,
    },
  ],
};

function params(estimateNumber: string): Promise<{ estimateNumber: string }> {
  return Promise.resolve({ estimateNumber });
}

describe("QuoteSuccessPage", () => {
  beforeEach(() => {
    mockCurrentUser.mockReset();
    mockGetEstimateByNumber.mockReset();
  });

  it("renders line items, total, and action buttons on happy path", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockResolvedValue(ESTIMATE);

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(screen.getByText("Quote Submitted")).toBeInTheDocument();
    expect(screen.getByText(/EST-00042/)).toBeInTheDocument();
    expect(screen.getByText("SG-1011")).toBeInTheDocument();
    expect(screen.getByText("LC-9018")).toBeInTheDocument();
    expect(screen.getByText(/8 items/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,383/)).toBeInTheDocument();

    const browse = screen.getByText("Browse Catalog").closest("a");
    const myQuotes = screen.getByText("My Quotes").closest("a");
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(browse?.getAttribute("href")).toBe("/eyeglasses");
    expect(myQuotes?.getAttribute("href")).toBe("/portal/quotes");
    expect(dashboard?.getAttribute("href")).toBe("/portal");
  });

  it("renders not-found state when estimate is null", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockResolvedValue(null);

    const element = await QuoteSuccessPage({ params: params("EST-99999") });
    render(element);

    expect(screen.getByText(/couldn.t find that quote/i)).toBeInTheDocument();
    expect(screen.getByText(/View My Quotes/).closest("a")?.getAttribute("href")).toBe(
      "/portal/quotes",
    );
  });

  it("renders generic error state when getEstimateByNumber throws", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockRejectedValue(new Error("Zoho 500"));

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(
      screen.getByText(/Unable to load quote right now/i),
    ).toBeInTheDocument();
  });

  it("renders account-setup error when zohoContactId missing", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_NO_ZOHO);

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(
      screen.getByText(/Account setup incomplete/i),
    ).toBeInTheDocument();
    expect(mockGetEstimateByNumber).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/app/portal/quote-success.test.tsx`
Expected: FAIL — page module not found.

- [ ] **Step 3: Create `app/portal/quote/success/[estimateNumber]/page.tsx`**

```tsx
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { getEstimateByNumber } from "@/lib/zoho/books";
import { formatPrice } from "@/lib/catalog/format";

export const metadata = {
  title: "Quote Submitted | LOUISLUSO",
};

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  const meta = isPartner(user!.publicMetadata) ? user!.publicMetadata : null;

  if (!meta?.zohoContactId) {
    return (
      <ErrorShell message="Account setup incomplete, contact support." />
    );
  }

  const { estimateNumber } = await params;

  let estimate;
  try {
    estimate = await getEstimateByNumber(meta.zohoContactId, estimateNumber);
  } catch (err) {
    console.error(
      `Failed to fetch estimate ${estimateNumber} for ${meta.zohoContactId}:`,
      err,
    );
    return (
      <ErrorShell message="Unable to load quote right now. Please try again in a moment." />
    );
  }

  if (!estimate) {
    console.warn(
      `Estimate not found for partner=${meta.zohoContactId} number=${estimateNumber}`,
    );
    return (
      <CenteredShell>
        <h2 className="font-heading text-2xl text-white">
          We couldn&apos;t find that quote.
        </h2>
        <p className="mt-4 text-sm text-gray-400">
          It may still be processing.
        </p>
        <Link
          href="/portal/quotes"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          View My Quotes
        </Link>
      </CenteredShell>
    );
  }

  const itemCount = estimate.line_items.reduce(
    (sum, li) => sum + li.quantity,
    0,
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-heading text-3xl text-white">Quote Submitted</h1>
        <p className="mt-4 text-sm text-gray-400">
          Quote {estimate.estimate_number} — Ken will review and confirm
          availability shortly.
        </p>

        <div className="mt-12 text-left">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
                <th className="pb-3">Product</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3 text-right">Unit</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {estimate.line_items.map((li) => (
                <tr key={li.line_item_id} className="border-b border-white/5">
                  <td className="py-3 text-gray-200">{li.name}</td>
                  <td className="py-3 text-gray-500">{li.sku ?? "—"}</td>
                  <td className="py-3 text-center text-gray-400">
                    {li.quantity}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {formatPrice(li.rate)}
                  </td>
                  <td className="py-3 text-right text-gray-200">
                    {formatPrice(li.item_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-right text-sm">
            <p className="text-gray-500">{itemCount} items</p>
            <p className="mt-1 font-semibold text-white">
              Subtotal {formatPrice(estimate.sub_total)}
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/eyeglasses"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <Link
            href="/portal/quotes"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            My Quotes
          </Link>
          <Link
            href="/portal"
            className="border border-white/10 px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function CenteredShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">{children}</div>
    </main>
  );
}

function ErrorShell({ message }: { message: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <p className="max-w-md text-center text-sm text-gray-400">{message}</p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/app/portal/quote-success.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the build compiles**

Run: `pnpm build`
Expected: `/portal/quote/success/[estimateNumber]` appears in the route list, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/portal/quote/success __tests__/app/portal/quote-success.test.tsx
git commit -m "feat: add /portal/quote/success/[estimateNumber] page"
```

---

### Task 11: Refactor `/portal/quote` page — redirect on submit

**Files:**
- Modify: `app/portal/quote/page.tsx`

- [ ] **Step 1: Update the page**

Replace `app/portal/quote/page.tsx` entirely with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/app/components/CartProvider";
import { formatPrice } from "@/lib/catalog/format";

export default function QuotePage(): React.ReactElement {
  const router = useRouter();
  const { items, subtotal, totalQuantity, update, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
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
        setSubmitting(false);
        return;
      }

      clear();
      router.push(
        `/portal/quote/success/${encodeURIComponent(data.estimateNumber)}`,
      );
    } catch {
      setError("Unable to submit quote. Please try again.");
      setSubmitting(false);
    }
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
          {totalQuantity} item{totalQuantity !== 1 ? "s" : ""} &middot;{" "}
          {formatPrice(subtotal)}
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
                  <td className="py-3 text-right text-gray-400">
                    {formatPrice(item.price)}
                  </td>
                  <td className="py-3 text-right text-gray-200">
                    {formatPrice(item.quantity * item.price)}
                  </td>
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
            <Link
              href="/eyeglasses"
              className="text-xs text-bronze hover:underline"
            >
              Continue Shopping
            </Link>
            <button
              onClick={clear}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Clear All
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-400">Subtotal</p>
            <p className="text-xl font-semibold text-white">
              {formatPrice(subtotal)}
            </p>
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

Note: the inline "Quote Submitted" branch (lines 47-65 of the old file) is removed. Cart is cleared, then `router.push` navigates to the success page.

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Run full test suite to ensure nothing regressed**

Run: `pnpm test`
Expected: all tests PASS. (The quote page itself has no component test — the API route test still passes because the API route is unchanged at this point.)

- [ ] **Step 4: Commit**

```bash
git add app/portal/quote/page.tsx
git commit -m "refactor: /portal/quote redirects to success page on submit"
```

---

### Task 12: Wire `revalidateTag` into `POST /api/portal/quote`

**Files:**
- Modify: `app/api/portal/quote/route.ts`
- Modify: `__tests__/app/api/portal/quote.test.ts`

- [ ] **Step 1: Write the failing test assertions**

Open `__tests__/app/api/portal/quote.test.ts`. Add hoisted mock for `revalidateTag` near the existing `vi.hoisted` calls at the top:

```typescript
const { mockRevalidateTag } = vi.hoisted(() => ({ mockRevalidateTag: vi.fn() }));
```

Add the mock call:

```typescript
vi.mock("next/cache", () => ({ revalidateTag: mockRevalidateTag }));
```

Inside `beforeEach`, add:

```typescript
mockRevalidateTag.mockReset();
```

Then add two new test cases at the end of the `describe` block:

```typescript
  it("calls revalidateTag('zoho-estimates-list') after successful submission", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));

    expect(response.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith("zoho-estimates-list");
  });

  it("does not fail the submission when revalidateTag throws", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    mockRevalidateTag.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
  });
```

- [ ] **Step 2: Run test to verify new cases fail**

Run: `pnpm test __tests__/app/api/portal/quote.test.ts`
Expected: the two new tests FAIL — `mockRevalidateTag` was not called.

- [ ] **Step 3: Update the route to call revalidateTag**

Open `app/api/portal/quote/route.ts` and add this import near the other imports at the top:

```typescript
import { revalidateTag } from "next/cache";
import { ESTIMATES_LIST_CACHE_TAG } from "@/lib/zoho/books";
```

After the line `const estimate = await createEstimate(zohoContactId, lineItems, notes);` and before the email try/catch block, add:

```typescript
    // Invalidate the cached quotes list so the new estimate appears immediately.
    // Wrapped in try/catch — a revalidation failure must not roll back a
    // successful estimate submission.
    try {
      revalidateTag(ESTIMATES_LIST_CACHE_TAG);
    } catch (revalErr) {
      console.error("Quote cache revalidation failed:", revalErr);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/app/api/portal/quote.test.ts`
Expected: all tests PASS, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add app/api/portal/quote/route.ts __tests__/app/api/portal/quote.test.ts
git commit -m "feat: invalidate quotes cache tag on successful submission"
```

---

### Task 13: Full verification + push

**Files:** None — verification only.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS (287 previous + ~30 new = ~317 tests).

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run production build**

Run: `pnpm build`
Expected: build succeeds. New routes in the output:
- `/portal/quotes`
- `/portal/quote/success/[estimateNumber]`

- [ ] **Step 4: Manual smoke test against local dev server**

Run: `pnpm dev`

In a browser signed in as a test partner:

1. Visit `/portal` — confirm "My Quotes" card is enabled and links to `/portal/quotes`.
2. Click "My Quotes" — confirm empty state (if no prior quotes) or table.
3. Open UserMenu — confirm "My Quotes" item present and links to `/portal/quotes`.
4. Add items to cart from a product page, go to `/portal/quote`, click Submit Quote.
5. Confirm redirect to `/portal/quote/success/EST-XXXXX` with a line-item table matching the cart.
6. Click "My Quotes" from the success page — confirm the newly submitted estimate is at the top of the list.
7. Visit `/portal/quotes?page=99` — confirm the past-end empty state with "Back to page 1" link.
8. Visit `/portal/quotes?page=garbage` — confirm it clamps to page 1 and renders normally.

If any step fails, create a new task describing what went wrong; do not mark the plan complete.

- [ ] **Step 5: Commit any manual test fixes**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: address 5d.1 smoke test findings"
```

- [ ] **Step 6: Push to GitHub**

```bash
git push origin main
```

Expected: remote accepts the push; `main` matches `origin/main`.

- [ ] **Step 7: Update status docs**

Open `docs/TODO.md` and replace the Phase 5d block:

```markdown
### Website Phase 5d.1: My Quotes — COMPLETE

### Website Phase 5d.2: Order detail (Shawn) — NEXT
- [ ] Drill into single estimate/sales order
- [ ] Line items, prices, status, notes
- [ ] URL: /portal/orders/[id]

### Website Phase 5d.3: Invoices + pay links (Shawn)
- [ ] List invoices at /portal/invoices
- [ ] Zoho Books public invoice_url for Stripe payment

### Website Phase 5d.4: Favorites (Shawn)
- [ ] Heart icon on product detail (partners only)
- [ ] /portal/favorites page, stored in Clerk metadata

### Website Phase 5d.5: Reorder (Shawn)
- [ ] "Reorder" button on past sales orders
- [ ] Rebuilds cart with current pricing
```

Open `CLAUDE.md` and update the phase status line:

```markdown
## New Website (in progress — Phase 5d.1 complete)
```

And under `### Phases`:

```markdown
   - **5c Cart/Quote** — COMPLETE ...
   - **5d.1 My Quotes** — COMPLETE (quote list, success page w/ line items, cache + rate limit)
   - **5d.2 Order detail** — next
```

- [ ] **Step 8: Commit docs + push**

```bash
git add docs/TODO.md CLAUDE.md
git commit -m "docs: mark Phase 5d.1 complete, 5d.2 next"
git push origin main
```

---

## Self-Review Results

- ✅ Spec coverage: every in-scope spec item maps to a task
  - Rate limit → Task 1
  - Status mapper → Task 2
  - getEstimatesForContact + pagination → Task 3
  - Cache wrapper → Task 4
  - getEstimateByNumber → Task 5
  - List page + table + empty/error/rate-limit states → Tasks 6, 7
  - Dashboard card, UserMenu → Tasks 8, 9
  - Success page → Task 10
  - 5c redirect → Task 11
  - revalidateTag wiring → Task 12
  - Build + manual smoke + push → Task 13
- ✅ No placeholders — all code blocks complete, all commands concrete
- ✅ Type consistency — `ESTIMATES_LIST_CACHE_TAG`, `EstimateListResult`, `ZohoEstimateDetail`, `partnerLabelForEstimateStatus` used consistently across tasks
- ✅ Test coverage — unit tests for data layer + rate limit + status mapper, component tests for QuotesTable + success page, integration test updates for the API route's revalidateTag behavior
