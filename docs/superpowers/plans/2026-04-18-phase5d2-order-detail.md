# Phase 5d.2 — Order Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Progress checkpoint — paused 2026-04-18 (resume at T10)

**Completed (commits on `main`):**

| Task | Commit(s) | Notes |
|---|---|---|
| T1 — workflow profile module | `c731967` + `445c0c7` (review fix: never-guards + hoist findIndex) | 18/18 tests |
| T2 — workflowProfile on PartnerMetadata | `09544ed` | 5/5 new + 5/5 existing |
| T3 — rateLimitOrderDetail | `3515bd7` | Fixed `vi.mock` hoisting bug in plan template using `vi.hoisted()` (matches repo convention) |
| T4 — zohoFetch tier-1 instrumentation | `db0cf66` | 2/2 new + 71/71 Zoho suite |
| T5 — getSalesOrderByReference + getInvoiceForSalesOrder | `99ec4da` + `26e1f0e` (review fix: zohoIdSchema validation + invoice sort_column) | 4/4 new |
| T6 — getOrderLifecycle orchestrator | `b4dbf15` | 8/8 lifecycle tests; graceful degrade verified |
| T7 — customer-isolation regression test | `c9f8816` | Pure pin of existing behavior; 1/1 pass with no production code change |
| T8 — getCachedOrderLifecycle wrapper | `25a9741` | 252/252 lib + zoho suites still passing |
| T9 — StatusTracker component | `f502857` | 5/5 component tests; review skipped at pause request |

**Next session resumes at T10.** Outstanding tasks:

| Task | What it does |
|---|---|
| **T10** — `OrderDetail` component | Layout wrapper: header → tracker → conditional invoice → conditional shipping → line items → actions → recovery footer |
| T11 — detail page (`page.tsx`) + `error.tsx` | Server Component (auth + rate limit + lifecycle fetch + render) and page-level error boundary |
| T12 — quote-fallback (schema + API + page) | Tier-2 no-auth fallback at `/quote-fallback` posting to Gmail |
| T13 — webhook stub `/api/webhooks/zoho` | Logs payload + 200; real handlers in 5e |
| T14 — success page → redirect | Slim `app/portal/quote/success/[estimateNumber]/page.tsx` to redirect to canonical detail URL |
| T15 — submit handler client redirect | One-line change in `app/portal/quote/page.tsx`: redirect to new canonical URL |
| T16 — QuotesTable row → Link | Wrap Quote # cell in Link to detail page |
| T17 — final sweep | `pnpm test` + `pnpm tsc --noEmit` + manual smoke + `git tag phase-5d.2-complete` + push |

**Resume instructions for the next session:**
1. Pull latest `main` (all T1-T9 work is already pushed).
2. Re-read this plan from the `## Task 10` heading downward.
3. Optional: re-review T9 (`f502857`) before starting T10 if anything looks off in the StatusTracker UI when you preview it.
4. Continue with the same subagent-driven pattern (implementer → spec review → code quality review → fixes → next task), or switch to inline executing-plans if preferred.

**Test discipline (still load-bearing):** failing test = fix code, not the test. Only update assertions when the asserted behavior is genuinely obsolete due to a deliberate, reviewed code change.

---

**Goal:** Build the canonical order-detail page at `/portal/quotes/[estimateNumber]` with a 5-stage lifecycle tracker, conditional invoice/shipping sections, two workflow profiles (cash + net30), and an always-on three-tier fallback chain so a buyer can never get stuck.

**Architecture:** Server-rendered Next.js App Router page hits a new `getOrderLifecycle(customerId, estimateNumber)` orchestrator that fetches estimate + linked sales order + invoice + shipment from Zoho Books in a single render. A pure `computeStages(profile, lifecycle)` helper turns Zoho state into ordered tracker stages per the partner's `workflowProfile` ("cash" or "net30"). Stage-tiered cache TTL (60s in-flight / 15min terminal) plus per-user rate limiting protect Zoho quota. Errors never strand the buyer — every failure path renders recovery affordances and the always-on `/quote-fallback` form.

**Tech Stack:** Next.js 16 (App Router, Server Components, `unstable_cache`), TypeScript strict, Zod, Clerk, Upstash Ratelimit, Vitest + RTL + jest-dom, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-18-phase5d2-order-detail-design.md`
**Architecture doc:** `docs/portal-architecture.md`

**Test discipline (load-bearing):** When a test fails, the default response is to fix the **code**, not the test. Only update assertions when the behavior asserted is genuinely obsolete due to a deliberate, reviewed code change. See `feedback_test_failure_discipline.md` in memory.

---

## File Structure

**New files (10):**
- `lib/portal/workflow.ts` — Profile registry, `getProfile`, `computeStages`, `computeCacheTTL` (pure)
- `lib/schemas/quote-fallback.ts` — Zod schema for the fallback form payload
- `app/portal/quotes/[estimateNumber]/page.tsx` — Server Component (auth + rate limit + fetch + render)
- `app/portal/quotes/[estimateNumber]/OrderDetail.tsx` — Layout wrapper (header → tracker → invoice → shipping → line items → actions)
- `app/portal/quotes/[estimateNumber]/StatusTracker.tsx` — Pure presentational tracker
- `app/portal/quotes/[estimateNumber]/error.tsx` — Page-level error boundary (Client Component)
- `app/quote-fallback/page.tsx` — Public no-auth fallback form
- `app/quote-fallback/SubmittedConfirmation.tsx` — Confirmation panel after successful submit
- `app/api/quote-fallback/route.ts` — POST handler (Zod validate → Gmail send → log → 200)
- `app/api/webhooks/zoho/route.ts` — Stub handler for future Zoho webhooks (5e wires real handlers)

**New test files (12):**
- `__tests__/lib/portal/workflow.test.ts`
- `__tests__/zoho/books-order-lifecycle.test.ts`
- `__tests__/zoho/books-customer-isolation.test.ts`
- `__tests__/zoho/zohoFetch-instrumentation.test.ts`
- `__tests__/lib/portal/types-workflow-profile.test.ts`
- `__tests__/lib/rate-limit-order-detail.test.ts`
- `__tests__/lib/schemas/quote-fallback.test.ts`
- `__tests__/app/portal/order-detail-page.test.tsx`
- `__tests__/app/portal/StatusTracker.test.tsx`
- `__tests__/app/portal/OrderDetail.test.tsx`
- `__tests__/app/quote-fallback/page.test.tsx`
- `__tests__/app/api/quote-fallback.test.ts`
- `__tests__/app/api/webhooks-zoho-stub.test.ts`
- `__tests__/app/portal/QuotesTable-link.test.tsx` (extends existing QuotesTable.test.tsx)

**Modified files (7):**
- `lib/portal/types.ts` — add `workflowProfile` to schema
- `lib/rate-limit.ts` — add `rateLimitOrderDetail`
- `lib/zoho/client.ts` — wrap `zohoFetch` with structured logging (Tier 1 observability)
- `lib/zoho/books.ts` — extend `ZohoSalesOrder` schema with packages, add `getSalesOrderByReference`, add `getInvoiceForSalesOrder`, add `ZohoInvoiceDetail` schema, add `getOrderLifecycle`, add `getCachedOrderLifecycle`
- `app/portal/quote/page.tsx` — change post-submit `router.push` target to `/portal/quotes/[estimateNumber]`
- `app/portal/quote/success/[estimateNumber]/page.tsx` — slim to redirect → `/portal/quotes/[estimateNumber]`
- `app/portal/quotes/QuotesTable.tsx` — wrap `Quote #` cell in `<Link>`

---

## Task 1 — Workflow profile module (pure)

**Files:**
- Create: `lib/portal/workflow.ts`
- Test: `__tests__/lib/portal/workflow.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/portal/workflow.test.ts
import { describe, it, expect } from "vitest";
import {
  WORKFLOW_PROFILES,
  getProfile,
  computeStages,
  computeCacheTTL,
  type StageId,
  type LifecycleData,
} from "@/lib/portal/workflow";

const baseLifecycle: LifecycleData = {
  estimate: { date: "2026-04-18", status: "sent" },
  salesOrder: null,
  invoice: null,
  shipment: null,
};

describe("WORKFLOW_PROFILES", () => {
  it("contains cash and net30 with five stages each", () => {
    expect(WORKFLOW_PROFILES.cash.stages).toHaveLength(5);
    expect(WORKFLOW_PROFILES.net30.stages).toHaveLength(5);
  });

  it("cash order is submitted → received → invoice_sent → payment_received → shipped", () => {
    expect(WORKFLOW_PROFILES.cash.stages).toEqual([
      "submitted",
      "received",
      "invoice_sent",
      "payment_received",
      "shipped",
    ]);
  });

  it("net30 order ships before invoice", () => {
    expect(WORKFLOW_PROFILES.net30.stages).toEqual([
      "submitted",
      "received",
      "shipped",
      "invoice_sent",
      "payment_received",
    ]);
  });
});

describe("getProfile", () => {
  it("returns cash when workflowProfile is undefined", () => {
    expect(getProfile(undefined).id).toBe("cash");
  });
  it("returns the named profile when valid", () => {
    expect(getProfile("net30").id).toBe("net30");
  });
  it("falls back to cash for unknown profile id", () => {
    expect(getProfile("bogus" as unknown as "cash").id).toBe("cash");
  });
});

describe("computeStages — cash profile", () => {
  const profile = WORKFLOW_PROFILES.cash;

  it("just-submitted: stage 1 done, stage 2 current, rest pending", () => {
    const stages = computeStages(profile, baseLifecycle);
    expect(stages.map((s) => s.status)).toEqual([
      "done",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
    expect(stages[0].date).toBe("2026-04-18");
  });

  it("accepted estimate: stage 2 done, stage 3 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
    });
    expect(stages[1].status).toBe("done");
    expect(stages[2].status).toBe("current");
  });

  it("invoice exists: stage 3 done, stage 4 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "sent", total: 100, last_payment_date: null },
    });
    expect(stages[2].status).toBe("done");
    expect(stages[3].status).toBe("current");
  });

  it("invoice paid: stage 4 done, stage 5 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
    });
    expect(stages[3].status).toBe("done");
    expect(stages[4].status).toBe("current");
  });

  it("shipped + paid: all done", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-24" },
    });
    expect(stages.every((s) => s.status === "done")).toBe(true);
  });

  it("declined estimate: stage 2 declined, stages 3-5 pending (terminal)", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "declined" },
    });
    expect(stages[1].status).toBe("declined");
    expect(stages.slice(2).every((s) => s.status === "pending")).toBe(true);
  });

  it("expired estimate: stage 2 expired", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "expired" },
    });
    expect(stages[1].status).toBe("expired");
  });
});

describe("computeStages — net30 profile", () => {
  const profile = WORKFLOW_PROFILES.net30;

  it("ships before invoice in stage order", () => {
    const ids = computeStages(profile, baseLifecycle).map((s) => s.id);
    expect(ids).toEqual([
      "submitted",
      "received",
      "shipped",
      "invoice_sent",
      "payment_received",
    ]);
  });

  it("shipment-then-invoice: stage 3 (shipped) done before stage 4 (invoice_sent)", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-22" },
    });
    expect(stages[2].id).toBe("shipped");
    expect(stages[2].status).toBe("done");
    expect(stages[3].id).toBe("invoice_sent");
    expect(stages[3].status).toBe("current");
  });
});

describe("computeCacheTTL", () => {
  it("returns 60 when any stage is in-flight", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, baseLifecycle);
    expect(computeCacheTTL(stages)).toBe(60);
  });

  it("returns 900 when all stages are done", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, {
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-24" },
    });
    expect(computeCacheTTL(stages)).toBe(900);
  });

  it("returns 900 when terminal-declined", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "declined" },
    });
    expect(computeCacheTTL(stages)).toBe(900);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/lib/portal/workflow.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/portal/workflow'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/portal/workflow.ts
export type StageId =
  | "submitted"
  | "received"
  | "invoice_sent"
  | "payment_received"
  | "shipped";

export type StageStatus =
  | "done"
  | "current"
  | "pending"
  | "declined"
  | "expired";

export interface WorkflowProfile {
  id: "cash" | "net30";
  label: string;
  stages: StageId[];
}

export const WORKFLOW_PROFILES: Record<WorkflowProfile["id"], WorkflowProfile> = {
  cash: {
    id: "cash",
    label: "Standard",
    stages: ["submitted", "received", "invoice_sent", "payment_received", "shipped"],
  },
  net30: {
    id: "net30",
    label: "NET 30",
    stages: ["submitted", "received", "shipped", "invoice_sent", "payment_received"],
  },
};

export function getProfile(id: WorkflowProfile["id"] | undefined): WorkflowProfile {
  if (id && id in WORKFLOW_PROFILES) return WORKFLOW_PROFILES[id];
  return WORKFLOW_PROFILES.cash;
}

export interface LifecycleData {
  estimate: {
    date: string;
    status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  };
  salesOrder: { created_time: string } | null;
  invoice: {
    date: string;
    status: "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void";
    total: number;
    last_payment_date: string | null;
  } | null;
  shipment: {
    tracking_number: string;
    carrier: string;
    date: string;
  } | null;
}

export interface StageState {
  id: StageId;
  label: string;
  status: StageStatus;
  date?: string;
  meta?: Record<string, string>;
}

const STAGE_LABELS: Record<StageId, string> = {
  submitted: "Quote Submitted",
  received: "Order Received",
  invoice_sent: "Invoice Sent",
  payment_received: "Payment Received",
  shipped: "Shipped",
};

function isStageDone(id: StageId, data: LifecycleData): boolean {
  switch (id) {
    case "submitted":
      return true;
    case "received":
      return data.estimate.status === "accepted" || data.salesOrder !== null;
    case "invoice_sent":
      return data.invoice !== null;
    case "payment_received":
      return data.invoice?.status === "paid";
    case "shipped":
      return Boolean(data.shipment?.tracking_number);
  }
}

function stageDate(id: StageId, data: LifecycleData): string | undefined {
  switch (id) {
    case "submitted":
      return data.estimate.date;
    case "received":
      return data.salesOrder?.created_time;
    case "invoice_sent":
      return data.invoice?.date;
    case "payment_received":
      return data.invoice?.last_payment_date ?? undefined;
    case "shipped":
      return data.shipment?.date;
  }
}

export function computeStages(profile: WorkflowProfile, data: LifecycleData): StageState[] {
  // Terminal-not-success paths short-circuit at stage 2.
  const terminal: StageStatus | null =
    data.estimate.status === "declined"
      ? "declined"
      : data.estimate.status === "expired"
        ? "expired"
        : null;

  return profile.stages.map((id, idx): StageState => {
    if (id === "submitted") {
      return { id, label: STAGE_LABELS[id], status: "done", date: stageDate(id, data) };
    }
    if (idx === 1 && terminal) {
      return { id, label: STAGE_LABELS[id], status: terminal };
    }
    if (terminal) {
      return { id, label: STAGE_LABELS[id], status: "pending" };
    }

    const done = isStageDone(id, data);
    if (done) {
      return { id, label: STAGE_LABELS[id], status: "done", date: stageDate(id, data) };
    }
    // First non-done stage = current. Subsequent = pending.
    const firstPendingIdx = profile.stages.findIndex((sid) => !isStageDone(sid, data));
    return {
      id,
      label: STAGE_LABELS[id],
      status: idx === firstPendingIdx ? "current" : "pending",
    };
  });
}

const TTL_IN_FLIGHT_SEC = 60;
const TTL_TERMINAL_SEC = 900; // 15 min

export function computeCacheTTL(stages: StageState[]): number {
  const allDone = stages.every((s) => s.status === "done");
  const anyTerminal = stages.some((s) => s.status === "declined" || s.status === "expired");
  return allDone || anyTerminal ? TTL_TERMINAL_SEC : TTL_IN_FLIGHT_SEC;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/lib/portal/workflow.test.ts
```

Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add lib/portal/workflow.ts __tests__/lib/portal/workflow.test.ts
git commit -m "feat(portal): workflow profiles + computeStages (pure)

Adds the cash + net30 workflow profile registry, getProfile() with default
fallback, computeStages() that maps Zoho lifecycle data into ordered tracker
stages per profile, and computeCacheTTL() for stage-aware TTL selection.
Pure functions — fully unit tested in __tests__/lib/portal/workflow.test.ts."
```

---

## Task 2 — Add `workflowProfile` to PartnerMetadata schema

**Files:**
- Modify: `lib/portal/types.ts`
- Test: `__tests__/lib/portal/types-workflow-profile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/portal/types-workflow-profile.test.ts
import { describe, it, expect } from "vitest";
import { partnerMetadataSchema, isPartner } from "@/lib/portal/types";

describe("partnerMetadataSchema — workflowProfile", () => {
  const base = { role: "partner", zohoContactId: "abc", company: "Acme Optics" };

  it("accepts metadata without workflowProfile (defaults later)", () => {
    expect(partnerMetadataSchema.safeParse(base).success).toBe(true);
  });

  it("accepts workflowProfile=cash", () => {
    const result = partnerMetadataSchema.safeParse({ ...base, workflowProfile: "cash" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workflowProfile).toBe("cash");
  });

  it("accepts workflowProfile=net30", () => {
    const result = partnerMetadataSchema.safeParse({ ...base, workflowProfile: "net30" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workflowProfile).toBe("net30");
  });

  it("rejects unknown workflowProfile values", () => {
    expect(
      partnerMetadataSchema.safeParse({ ...base, workflowProfile: "consignment" }).success,
    ).toBe(false);
  });

  it("isPartner still passes for valid base + workflowProfile combo", () => {
    expect(isPartner({ ...base, workflowProfile: "net30" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/lib/portal/types-workflow-profile.test.ts
```

Expected: FAIL — `unrecognized_keys: ["workflowProfile"]` because Zod strict mode rejects unknown keys, OR test asserting `data.workflowProfile === "cash"` fails because it isn't on the type.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/portal/types.ts
import { z } from "zod";

export const partnerMetadataSchema = z.object({
  role: z.literal("partner"),
  zohoContactId: z.string().min(1),
  company: z.string().min(1),
  pricingPlanId: z.string().optional(),
  workflowProfile: z.enum(["cash", "net30"]).optional(),
});

export type PartnerMetadata = z.infer<typeof partnerMetadataSchema>;

export function isPartner(metadata: unknown): metadata is PartnerMetadata {
  return partnerMetadataSchema.safeParse(metadata).success;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/lib/portal/types-workflow-profile.test.ts __tests__/lib/portal/types.test.ts
```

Expected: PASS for both new and existing types tests.

- [ ] **Step 5: Commit**

```bash
git add lib/portal/types.ts __tests__/lib/portal/types-workflow-profile.test.ts
git commit -m "feat(portal): add workflowProfile to PartnerMetadata

Optional enum (cash | net30) on PartnerMetadata. Existing partners with no
field set fall through to the cash default in lib/portal/workflow.ts —
zero migration required."
```

---

## Task 3 — Per-user rate limit for the order detail page

**Files:**
- Modify: `lib/rate-limit.ts`
- Test: `__tests__/lib/rate-limit-order-detail.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/rate-limit-order-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @upstash/ratelimit so the test doesn't need real Redis.
const limitMock = vi.fn().mockResolvedValue({ success: true, remaining: 59 });
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    limit = limitMock;
    static slidingWindow = vi.fn(() => "sliding");
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@/lib/env", () => ({
  env: { UPSTASH_REDIS_REST_URL: "x", UPSTASH_REDIS_REST_TOKEN: "y" },
}));

import { rateLimitOrderDetail } from "@/lib/rate-limit";

describe("rateLimitOrderDetail", () => {
  beforeEach(() => limitMock.mockClear());

  it("delegates to the order-detail limiter and returns success+remaining", async () => {
    const result = await rateLimitOrderDetail("user_123");
    expect(limitMock).toHaveBeenCalledWith("user_123");
    expect(result).toEqual({ success: true, remaining: 59 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/lib/rate-limit-order-detail.test.ts
```

Expected: FAIL — `rateLimitOrderDetail` is not exported.

- [ ] **Step 3: Write minimal implementation (append to lib/rate-limit.ts)**

Add the following block to `lib/rate-limit.ts` (after the existing `quotesListLimiter`):

```typescript
const orderDetailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "5 m"),
  prefix: "louisluso:order-detail",
});

export async function rateLimitOrderDetail(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await orderDetailLimiter.limit(identifier);
  return { success, remaining };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/lib/rate-limit-order-detail.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts __tests__/lib/rate-limit-order-detail.test.ts
git commit -m "feat(rate-limit): add rateLimitOrderDetail (60 req / 5min / user)"
```

---

## Task 4 — `zohoFetch` instrumentation (Tier 1 observability)

**Files:**
- Modify: `lib/zoho/client.ts`
- Test: `__tests__/zoho/zohoFetch-instrumentation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/zoho/zohoFetch-instrumentation.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import { zohoFetch } from "@/lib/zoho/client";

describe("zohoFetch instrumentation", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 0, ok: true }), { status: 200 }),
    );
  });
  afterEach(() => {
    logSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("emits a structured log line on every successful call", async () => {
    await zohoFetch("/books/v3/estimates");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      tag: "zoho_call",
      method: "GET",
      endpoint: "/books/v3/estimates",
      status: 200,
    });
    expect(typeof parsed.ms).toBe("number");
    expect(parsed.ms).toBeGreaterThanOrEqual(0);
  });

  it("logs failed calls with the response status", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 429 }));
    await expect(zohoFetch("/books/v3/estimates")).rejects.toThrow();
    const arg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/zoho/zohoFetch-instrumentation.test.ts
```

Expected: FAIL — `console.info` is not called from `zohoFetch`.

- [ ] **Step 3: Write minimal implementation**

In `lib/zoho/client.ts`, wrap the fetch call with timing and emit a single structured log line. Replace the `const response = await fetch(...)` block and the surrounding error path with the version below:

```typescript
// lib/zoho/client.ts (only the changed section is shown — keep imports + ZohoApiError class as-is)

const startedAt = Date.now();
let response: Response;
try {
  response = await fetch(url.toString(), { method, headers, body });
} catch (err) {
  console.info(
    JSON.stringify({
      tag: "zoho_call",
      method,
      endpoint: path,
      status: 0,
      ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  throw err;
}

const ms = Date.now() - startedAt;
console.info(
  JSON.stringify({
    tag: "zoho_call",
    method,
    endpoint: path,
    status: response.status,
    ms,
  }),
);

if (!response.ok) {
  const errorBody = await response.text();
  console.error(`Zoho API error [${method} ${path}]: ${response.status} ${errorBody}`);
  throw new ZohoApiError(
    "Zoho API request failed",
    errorBody,
    response.status,
  );
}
```

(Leave the post-response Zoho `code !== 0` handler intact below this block.)

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/zoho/zohoFetch-instrumentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/client.ts __tests__/zoho/zohoFetch-instrumentation.test.ts
git commit -m "feat(zoho/client): tier 1 observability — log every Zoho call

Structured JSON log line per call: { tag: 'zoho_call', method, endpoint,
status, ms }. Goes to console.info → captured by Vercel function logs.
First building block for the observability tiers in portal-architecture.md."
```

---

## Task 5 — Extend `ZohoSalesOrder` with packages + add lookups by reference

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: `__tests__/zoho/books-order-lifecycle.test.ts` (will grow over Tasks 5-7)

- [ ] **Step 1: Write the failing test (Task-5 portion)**

```typescript
// __tests__/zoho/books-order-lifecycle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import {
  getSalesOrderByReference,
  getInvoiceForSalesOrder,
} from "@/lib/zoho/books";

describe("getSalesOrderByReference", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns the matching sales order with packages parsed", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorders: [
            { salesorder_id: "so_1", reference_number: "EST-001" },
          ],
        }),
        { status: 200 },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorder: {
            salesorder_id: "so_1",
            salesorder_number: "SO-1",
            customer_id: "cust_1",
            customer_name: "Acme",
            status: "confirmed",
            total: 100,
            line_items: [],
            date: "2026-04-19",
            created_time: "2026-04-19T10:00:00Z",
            packages: [
              {
                package_id: "pkg_1",
                package_number: "PKG-1",
                tracking_number: "1Z999AA1",
                delivery_method: "UPS",
                shipment_date: "2026-04-22",
                status: "shipped",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const so = await getSalesOrderByReference("cust_1", "EST-001");
    expect(so).not.toBeNull();
    expect(so?.salesorder_id).toBe("so_1");
    expect(so?.packages).toHaveLength(1);
    expect(so?.packages[0].tracking_number).toBe("1Z999AA1");
  });

  it("returns null when no matching reference_number found", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, salesorders: [] }), { status: 200 }),
    );
    expect(await getSalesOrderByReference("cust_1", "EST-404")).toBeNull();
  });
});

describe("getInvoiceForSalesOrder", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns the most-recent invoice linked to the sales order", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          invoices: [
            {
              invoice_id: "inv_1",
              invoice_number: "INV-1",
              status: "sent",
              total: 100,
              balance: 100,
              date: "2026-04-20",
              due_date: "2026-04-30",
              last_payment_date: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const inv = await getInvoiceForSalesOrder("so_1");
    expect(inv?.invoice_id).toBe("inv_1");
    expect(inv?.last_payment_date).toBeNull();
  });

  it("returns null when no invoice exists yet", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, invoices: [] }), { status: 200 }),
    );
    expect(await getInvoiceForSalesOrder("so_1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/zoho/books-order-lifecycle.test.ts
```

Expected: FAIL — `getSalesOrderByReference` / `getInvoiceForSalesOrder` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/zoho/books.ts`:

```typescript
// --- Phase 5d.2 additions ---

import { z } from "zod"; // already imported above; if not, add

const packageSchema = z.object({
  package_id: z.string(),
  package_number: z.string().optional(),
  tracking_number: z.string().optional(),
  delivery_method: z.string().optional(),
  shipment_date: z.string().optional(),
  status: z.string().optional(),
});

const salesOrderDetailSchema = z.object({
  salesorder_id: z.string(),
  salesorder_number: z.string(),
  customer_id: z.string(),
  customer_name: z.string(),
  status: z.string(),
  total: z.number(),
  date: z.string(),
  created_time: z.string(),
  line_items: z.array(z.unknown()),
  packages: z.array(packageSchema).default([]),
});

export type ZohoSalesOrderDetail = z.infer<typeof salesOrderDetailSchema>;

const salesOrderSearchSchema = z.object({
  salesorders: z.array(z.object({ salesorder_id: z.string(), reference_number: z.string().optional() })),
});

export async function getSalesOrderByReference(
  customerId: string,
  estimateNumber: string,
): Promise<ZohoSalesOrderDetail | null> {
  const search = await zohoFetch<unknown>("/books/v3/salesorders", {
    params: { customer_id: customerId, reference_number: estimateNumber },
  });
  const parsedSearch = salesOrderSearchSchema.safeParse(search);
  if (!parsedSearch.success) {
    console.error("getSalesOrderByReference: search parse failed", parsedSearch.error.flatten());
    return null;
  }
  const match = parsedSearch.data.salesorders.find(
    (so) => so.reference_number === estimateNumber,
  );
  if (!match) return null;

  const detailRes = await zohoFetch<unknown>(`/books/v3/salesorders/${match.salesorder_id}`);
  const parsedDetail = z.object({ salesorder: salesOrderDetailSchema }).safeParse(detailRes);
  if (!parsedDetail.success) {
    console.error("getSalesOrderByReference: detail parse failed", parsedDetail.error.flatten());
    return null;
  }
  if (parsedDetail.data.salesorder.customer_id !== customerId) return null;
  return parsedDetail.data.salesorder;
}

const invoiceListItemSchema = z.object({
  invoice_id: z.string(),
  invoice_number: z.string(),
  status: z.enum([
    "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void",
  ]),
  total: z.number(),
  balance: z.number(),
  date: z.string(),
  due_date: z.string().optional(),
  last_payment_date: z.string().nullable().optional(),
});

export type ZohoInvoiceForOrder = z.infer<typeof invoiceListItemSchema>;

const invoicesListSchema = z.object({
  invoices: z.array(invoiceListItemSchema),
});

export async function getInvoiceForSalesOrder(
  salesOrderId: string,
): Promise<ZohoInvoiceForOrder | null> {
  const res = await zohoFetch<unknown>("/books/v3/invoices", {
    params: { salesorder_id: salesOrderId },
  });
  const parsed = invoicesListSchema.safeParse(res);
  if (!parsed.success) {
    console.error("getInvoiceForSalesOrder: parse failed", parsed.error.flatten());
    return null;
  }
  if (parsed.data.invoices.length === 0) return null;
  // Most-recent first (Zoho default sort, but be explicit)
  return parsed.data.invoices[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/zoho/books-order-lifecycle.test.ts
```

Expected: PASS for the four test cases added in this task.

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/zoho/books-order-lifecycle.test.ts
git commit -m "feat(zoho/books): getSalesOrderByReference + getInvoiceForSalesOrder

Adds detail-level Zod schemas for sales-order packages array and invoice
list items. Both helpers use safeParse so Zoho schema drift surfaces in
logs rather than crashing the page (per spec § 7 error handling #10)."
```

---

## Task 6 — `getOrderLifecycle` orchestrator

**Files:**
- Modify: `lib/zoho/books.ts`
- Test: extend `__tests__/zoho/books-order-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test (append to the existing file)**

```typescript
// Append to __tests__/zoho/books-order-lifecycle.test.ts

import { getOrderLifecycle } from "@/lib/zoho/books";

describe("getOrderLifecycle", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  function mockEstimateLookup(customerId: string, estimateNumber: string) {
    // Search response
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimates: [{ estimate_id: "est_1", estimate_number: estimateNumber, customer_id: customerId }],
        }),
        { status: 200 },
      ),
    );
    // Detail response
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimate: {
            estimate_id: "est_1",
            estimate_number: estimateNumber,
            customer_id: customerId,
            date: "2026-04-18",
            status: "sent",
            total: 100,
            sub_total: 100,
            currency_code: "USD",
            line_items: [],
          },
        }),
        { status: 200 },
      ),
    );
  }

  it("returns null when the estimate is not found", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, estimates: [] }), { status: 200 }),
    );
    expect(await getOrderLifecycle("cust_1", "EST-NONE")).toBeNull();
  });

  it("happy path — estimate only (no SO yet)", async () => {
    mockEstimateLookup("cust_1", "EST-1");
    // SO search returns empty
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, salesorders: [] }), { status: 200 }),
    );
    const lifecycle = await getOrderLifecycle("cust_1", "EST-1");
    expect(lifecycle).not.toBeNull();
    expect(lifecycle?.estimate.estimate_number).toBe("EST-1");
    expect(lifecycle?.salesOrder).toBeNull();
    expect(lifecycle?.invoice).toBeNull();
    expect(lifecycle?.shipment).toBeNull();
  });

  it("happy path — full lifecycle with shipment", async () => {
    mockEstimateLookup("cust_1", "EST-2");
    // SO search → match
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorders: [{ salesorder_id: "so_1", reference_number: "EST-2" }],
        }),
        { status: 200 },
      ),
    );
    // SO detail with packages
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorder: {
            salesorder_id: "so_1",
            salesorder_number: "SO-1",
            customer_id: "cust_1",
            customer_name: "Acme",
            status: "confirmed",
            total: 100,
            line_items: [],
            date: "2026-04-19",
            created_time: "2026-04-19T10:00:00Z",
            packages: [
              {
                package_id: "pkg_1",
                tracking_number: "1Z999AA1",
                delivery_method: "UPS",
                shipment_date: "2026-04-22",
                status: "shipped",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    // Invoice list
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          invoices: [
            {
              invoice_id: "inv_1",
              invoice_number: "INV-1",
              status: "paid",
              total: 100,
              balance: 0,
              date: "2026-04-20",
              due_date: "2026-04-30",
              last_payment_date: "2026-04-22",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const lifecycle = await getOrderLifecycle("cust_1", "EST-2");
    expect(lifecycle?.salesOrder?.salesorder_id).toBe("so_1");
    expect(lifecycle?.invoice?.status).toBe("paid");
    expect(lifecycle?.shipment?.tracking_number).toBe("1Z999AA1");
    expect(lifecycle?.shipment?.carrier).toBe("UPS");
  });

  it("graceful degrade — sales-order fetch fails, returns estimate-only", async () => {
    mockEstimateLookup("cust_1", "EST-3");
    fetchSpy.mockRejectedValueOnce(new Error("SO endpoint down"));
    const lifecycle = await getOrderLifecycle("cust_1", "EST-3");
    expect(lifecycle?.estimate.estimate_number).toBe("EST-3");
    expect(lifecycle?.salesOrder).toBeNull();
    expect(lifecycle?.invoice).toBeNull();
    expect(lifecycle?.shipment).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/zoho/books-order-lifecycle.test.ts
```

Expected: FAIL — `getOrderLifecycle` not exported.

- [ ] **Step 3: Write minimal implementation (append to lib/zoho/books.ts)**

```typescript
export interface OrderShipment {
  tracking_number: string;
  carrier: string;
  date: string;
}

export interface OrderLifecycle {
  estimate: ZohoEstimateDetail;
  salesOrder: ZohoSalesOrderDetail | null;
  invoice: ZohoInvoiceForOrder | null;
  shipment: OrderShipment | null;
}

function pickShipment(so: ZohoSalesOrderDetail | null): OrderShipment | null {
  if (!so) return null;
  const withTracking = so.packages.find((p) => p.tracking_number && p.shipment_date);
  if (!withTracking) return null;
  return {
    tracking_number: withTracking.tracking_number ?? "",
    carrier: withTracking.delivery_method ?? "",
    date: withTracking.shipment_date ?? "",
  };
}

export async function getOrderLifecycle(
  customerId: string,
  estimateNumber: string,
): Promise<OrderLifecycle | null> {
  const estimate = await getEstimateByNumber(customerId, estimateNumber);
  if (!estimate) return null;

  let salesOrder: ZohoSalesOrderDetail | null = null;
  try {
    salesOrder = await getSalesOrderByReference(customerId, estimateNumber);
  } catch (err) {
    console.error("getOrderLifecycle: salesOrder fetch failed", err);
  }

  let invoice: ZohoInvoiceForOrder | null = null;
  if (salesOrder) {
    try {
      invoice = await getInvoiceForSalesOrder(salesOrder.salesorder_id);
    } catch (err) {
      console.error("getOrderLifecycle: invoice fetch failed", err);
    }
  }

  return {
    estimate,
    salesOrder,
    invoice,
    shipment: pickShipment(salesOrder),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/zoho/books-order-lifecycle.test.ts
```

Expected: PASS for all describe blocks (including the four cases added in Task 5).

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/books.ts __tests__/zoho/books-order-lifecycle.test.ts
git commit -m "feat(zoho/books): getOrderLifecycle orchestrator

Single-call orchestrator that fetches estimate + linked sales order +
invoice + shipment for one estimate-number. Sales-order and invoice
fetches each guarded — if either errors, the lifecycle returns with
nulls for the missing fields instead of hard-failing (graceful degrade
per spec § 7 error handling #9)."
```

---

## Task 7 — Customer-isolation defensive check

**Files:**
- Test: `__tests__/zoho/books-customer-isolation.test.ts`

This task adds a regression guard that confirms `getOrderLifecycle` does not return another customer's data even if the URL contains a valid estimate number for someone else. The protection itself already exists (`getEstimateByNumber` returns null when `customer_id` mismatches), but the test pins it down.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/zoho/books-customer-isolation.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import { getOrderLifecycle } from "@/lib/zoho/books";

describe("getOrderLifecycle — customer isolation", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns null when an estimate exists but belongs to a different customer", async () => {
    // Search returns the estimate (Zoho's search filter on customer_id is honored,
    // but if a partner crafts a URL bypassing the filter, the search can still
    // surface it). The detail endpoint then exposes the true customer_id.
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimates: [{ estimate_id: "est_x", estimate_number: "EST-OTHER", customer_id: "other_cust" }],
        }),
        { status: 200 },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimate: {
            estimate_id: "est_x",
            estimate_number: "EST-OTHER",
            customer_id: "other_cust",
            date: "2026-04-18",
            status: "sent",
            total: 100,
            sub_total: 100,
            currency_code: "USD",
            line_items: [],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getOrderLifecycle("attacker_cust", "EST-OTHER");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/zoho/books-customer-isolation.test.ts
```

Expected: PASS already (because `getEstimateByNumber` does the customer match). If it FAILS, that's a real security gap — fix `getEstimateByNumber` (in `lib/zoho/books.ts`, the line `if (detailParsed.estimate.customer_id !== customerId) return null;` must be present).

- [ ] **Step 3: Write minimal implementation (only if Step 2 fails)**

If the test failed in Step 2, the bug is in `getEstimateByNumber`. Add the customer-id check there. If the test passed in Step 2, no implementation is needed — the test pins the existing behavior.

- [ ] **Step 4: Run test again and confirm**

```
pnpm test __tests__/zoho/books-customer-isolation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/zoho/books-customer-isolation.test.ts
git commit -m "test(zoho/books): customer-isolation regression guard

Locks in the behavior that getOrderLifecycle returns null when an estimate
exists but belongs to a different customer — defensive against partners
crafting URLs to view another partner's quote."
```

---

## Task 8 — Cached `getOrderLifecycle` with stage-aware TTL

**Files:**
- Modify: `lib/zoho/books.ts`
- (No new tests — covered by integration via the page tests in Task 11. The cache wrapper itself is a thin `unstable_cache` call.)

- [ ] **Step 1: Add the cached wrapper**

Append to `lib/zoho/books.ts`:

```typescript
import { unstable_cache } from "next/cache"; // already imported above; verify

export const ORDER_LIFECYCLE_CACHE_TAG_PREFIX = "order-lifecycle";
export function orderLifecycleTag(customerId: string, estimateNumber: string): string {
  return `${ORDER_LIFECYCLE_CACHE_TAG_PREFIX}:${customerId}:${estimateNumber}`;
}

// Cached wrapper. TTL is tier-1 (60s) by default; the page picks a longer
// TTL via revalidateTag once stages are known to be terminal. We don't bake
// stage-aware TTL into the cache key because that would defeat caching.
export function getCachedOrderLifecycle(
  customerId: string,
  estimateNumber: string,
): Promise<OrderLifecycle | null> {
  return unstable_cache(
    async () => getOrderLifecycle(customerId, estimateNumber),
    ["order-lifecycle", customerId, estimateNumber],
    {
      tags: [orderLifecycleTag(customerId, estimateNumber)],
      revalidate: 60,
    },
  )();
}
```

- [ ] **Step 2: Verify tsc passes**

```
pnpm tsc --noEmit
```

Expected: no new errors related to this module.

- [ ] **Step 3: Verify all books-related tests still pass**

```
pnpm test __tests__/zoho/
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/zoho/books.ts
git commit -m "feat(zoho/books): cached getOrderLifecycle wrapper

Wraps getOrderLifecycle with unstable_cache, tagged per customer +
estimate number, 60s revalidate. Future Zoho webhook handler in 5e
will call revalidateTag(orderLifecycleTag(...)) on relevant events."
```

---

## Task 9 — `StatusTracker` component

**Files:**
- Create: `app/portal/quotes/[estimateNumber]/StatusTracker.tsx`
- Test: `__tests__/app/portal/StatusTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/portal/StatusTracker.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusTracker } from "@/app/portal/quotes/[estimateNumber]/StatusTracker";
import { WORKFLOW_PROFILES, computeStages } from "@/lib/portal/workflow";

describe("StatusTracker", () => {
  const profile = WORKFLOW_PROFILES.cash;

  it("renders five stage labels", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "sent" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByText("Quote Submitted")).toBeInTheDocument();
    expect(screen.getByText("Order Received")).toBeInTheDocument();
    expect(screen.getByText("Invoice Sent")).toBeInTheDocument();
    expect(screen.getByText("Payment Received")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
  });

  it("uses role=progressbar with aria-valuenow=current stage index+1", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    const tracker = screen.getByRole("progressbar");
    expect(tracker).toHaveAttribute("aria-valuemax", "5");
    expect(tracker).toHaveAttribute("aria-valuenow", "3"); // stages 1-2 done, stage 3 current
  });

  it("renders submitted-stage date subtitle", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "sent" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    // Date must appear somewhere in the tracker
    expect(screen.getByText(/2026-04-18/)).toBeInTheDocument();
  });

  it("declined estimate: stage 2 has aria-label including 'Declined'", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "declined" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    const declinedStage = screen.getByLabelText(/Declined/);
    expect(declinedStage).toBeInTheDocument();
  });

  it("expired estimate: stage 2 has aria-label including 'Expired'", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "expired" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByLabelText(/Expired/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/portal/StatusTracker.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/portal/quotes/[estimateNumber]/StatusTracker.tsx
import type { StageState } from "@/lib/portal/workflow";

interface Props {
  stages: StageState[];
}

const SYMBOL: Record<StageState["status"], string> = {
  done: "●",
  current: "◉",
  pending: "○",
  declined: "✕",
  expired: "⏱",
};

const STATUS_TEXT: Record<StageState["status"], string> = {
  done: "completed",
  current: "in progress",
  pending: "pending",
  declined: "Declined",
  expired: "Expired",
};

const STATUS_COLOR: Record<StageState["status"], string> = {
  done: "text-bronze",
  current: "text-bronze",
  pending: "text-gray-500",
  declined: "text-red-500",
  expired: "text-gray-400",
};

export function StatusTracker({ stages }: Props): React.ReactElement {
  const currentIdx = stages.findIndex((s) => s.status === "current");
  const ariaNow = currentIdx >= 0 ? currentIdx + 1 : stages.filter((s) => s.status === "done").length;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stages.length}
      aria-valuenow={Math.max(1, ariaNow)}
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0"
    >
      {stages.map((stage, idx) => (
        <div key={stage.id} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
          <div className="flex items-center sm:flex-col">
            <div
              aria-label={`${stage.label}, ${STATUS_TEXT[stage.status]}${stage.date ? `, ${stage.date}` : ""}`}
              className={`flex h-8 w-8 items-center justify-center text-xl ${STATUS_COLOR[stage.status]}`}
            >
              {SYMBOL[stage.status]}
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`hidden h-px flex-1 sm:block ${
                  stage.status === "done" ? "bg-bronze" : "bg-white/10"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="sm:mt-2">
            <p className={`text-xs font-medium uppercase tracking-wider ${STATUS_COLOR[stage.status]}`}>
              {stage.label}
            </p>
            {stage.date && (
              <p className="text-[11px] text-gray-500">{stage.date}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/portal/StatusTracker.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/portal/quotes/[estimateNumber]/StatusTracker.tsx __tests__/app/portal/StatusTracker.test.tsx
git commit -m "feat(portal): StatusTracker component (5-stage UPS-style)

Pure presentational tracker. Profile-driven stage order via the StageState
array passed in. Symbols + colors carry meaning beyond color alone.
role=progressbar + aria-valuenow + per-stage aria-label for a11y."
```

---

## Task 10 — `OrderDetail` component

**Files:**
- Create: `app/portal/quotes/[estimateNumber]/OrderDetail.tsx`
- Test: `__tests__/app/portal/OrderDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/app/portal/OrderDetail.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDetail } from "@/app/portal/quotes/[estimateNumber]/OrderDetail";
import { WORKFLOW_PROFILES } from "@/lib/portal/workflow";

const baseEstimate = {
  estimate_id: "est_1",
  estimate_number: "EST-001",
  customer_id: "cust_1",
  date: "2026-04-18",
  status: "sent" as const,
  total: 432.5,
  sub_total: 432.5,
  currency_code: "USD",
  line_items: [
    { line_item_id: "li_1", item_id: "item_1", name: "SP1018", sku: "SP1018-C2", quantity: 5, rate: 50, item_total: 250 },
    { line_item_id: "li_2", item_id: "item_2", name: "T-7241", sku: "T-7241-C8", quantity: 3, rate: 60.83, item_total: 182.5 },
  ],
};

describe("OrderDetail", () => {
  it("renders header with estimate number and submission date", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByRole("heading", { name: /EST-001/ })).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  it("does NOT render invoice section when no invoice exists", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.queryByText(/Invoice #/)).not.toBeInTheDocument();
  });

  it("renders invoice section with Pay + PDF buttons when invoice is sent and unpaid", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={{ invoice_id: "inv_1", invoice_number: "INV-1", status: "sent", total: 432.5, balance: 432.5, date: "2026-04-20", due_date: "2026-04-30", last_payment_date: null }}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByText(/INV-1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pay Invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download PDF/ })).toBeInTheDocument();
  });

  it("replaces pay buttons with Paid badge when invoice is paid", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={{ invoice_id: "inv_1", invoice_number: "INV-1", status: "paid", total: 432.5, balance: 0, date: "2026-04-20", due_date: "2026-04-30", last_payment_date: "2026-04-22" }}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByText(/Paid/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pay Invoice/ })).not.toBeInTheDocument();
  });

  it("renders shipping section with tracking when shipment exists", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={null}
        shipment={{ tracking_number: "1Z999AA10123456784", carrier: "UPS", date: "2026-04-24" }}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByText(/Tracking/)).toBeInTheDocument();
    expect(screen.getByText(/1Z999AA10123456784/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Track Package/ })).toBeInTheDocument();
  });

  it("always renders the universal recovery footer with errorId", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_abc123"
      />,
    );
    expect(screen.getByText(/req_abc123/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submit a quote without logging in/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/portal/OrderDetail.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/portal/quotes/[estimateNumber]/OrderDetail.tsx
import Link from "next/link";
import type {
  ZohoEstimateDetail,
  ZohoSalesOrderDetail,
  ZohoInvoiceForOrder,
  OrderShipment,
} from "@/lib/zoho/books";
import { computeStages, type WorkflowProfile } from "@/lib/portal/workflow";
import { formatPrice } from "@/lib/catalog/format";
import { StatusTracker } from "./StatusTracker";

interface Props {
  estimate: ZohoEstimateDetail;
  salesOrder: ZohoSalesOrderDetail | null;
  invoice: ZohoInvoiceForOrder | null;
  shipment: OrderShipment | null;
  profile: WorkflowProfile;
  errorId: string;
  zohoInvoiceUrl?: string; // optional, real URL filled in by 5d.3
}

const CARRIER_TRACKING_URLS: Record<string, (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
};

function trackingUrl(carrier: string, tracking: string): string {
  const fn = CARRIER_TRACKING_URLS[carrier] ?? ((n: string) => `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${n}`)}`);
  return fn(tracking);
}

export function OrderDetail({
  estimate,
  salesOrder,
  invoice,
  shipment,
  profile,
  errorId,
  zohoInvoiceUrl,
}: Props): React.ReactElement {
  const stages = computeStages(profile, {
    estimate: { date: estimate.date, status: estimate.status },
    salesOrder: salesOrder ? { created_time: salesOrder.created_time } : null,
    invoice: invoice
      ? {
          date: invoice.date,
          status: invoice.status,
          total: invoice.total,
          last_payment_date: invoice.last_payment_date ?? null,
        }
      : null,
    shipment,
  });

  const itemCount = estimate.line_items.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl text-white">Quote #{estimate.estimate_number}</h1>
        <p className="mt-2 text-sm text-gray-500">Submitted {estimate.date}</p>

        <div className="mt-10">
          <StatusTracker stages={stages} />
        </div>

        {invoice && (
          <section className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-heading text-lg text-white">Invoice #{invoice.invoice_number}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Amount: {formatPrice(invoice.total)}
              {invoice.due_date ? ` • Due: ${invoice.due_date}` : ""}
            </p>
            {invoice.status === "paid" ? (
              <p className="mt-3 text-sm text-bronze">✓ Paid {invoice.last_payment_date ?? ""}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {zohoInvoiceUrl && (
                  <a
                    href={zohoInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-bronze px-4 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
                  >
                    Pay Invoice
                  </a>
                )}
                <a
                  href={`https://books.zoho.com/app/invoices/${invoice.invoice_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-white/15 px-4 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
                >
                  Download PDF
                </a>
              </div>
            )}
          </section>
        )}

        {shipment && (
          <section className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-heading text-lg text-white">Shipped {shipment.date}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Tracking: {shipment.tracking_number} ({shipment.carrier})
            </p>
            <a
              href={trackingUrl(shipment.carrier, shipment.tracking_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block border border-bronze px-4 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
            >
              Track Package
            </a>
          </section>
        )}

        <section className="mt-12">
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
                  <td className="py-3 text-center text-gray-400">{li.quantity}</td>
                  <td className="py-3 text-right text-gray-400">{formatPrice(li.rate)}</td>
                  <td className="py-3 text-right text-gray-200">{formatPrice(li.item_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-right text-sm">
            <p className="text-gray-500">{itemCount} items</p>
            <p className="mt-1 font-semibold text-white">Subtotal {formatPrice(estimate.sub_total)}</p>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <a
            href={`mailto:cs@louisluso.com?subject=Question%20about%20quote%20${encodeURIComponent(estimate.estimate_number)}`}
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Email Ken about this quote
          </a>
          <Link
            href="/eyeglasses"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <Link
            href="/portal/quotes"
            className="border border-white/10 px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-gray-400 hover:border-white/20 hover:text-white"
          >
            My Quotes
          </Link>
        </div>

        <footer className="mt-16 border-t border-white/5 pt-6 text-center text-xs text-gray-500">
          Need help? Email{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>{" "}
          or{" "}
          <Link href="/quote-fallback" className="text-bronze hover:underline">
            submit a quote without logging in
          </Link>
          . Reference: <code className="text-gray-400">{errorId}</code>
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/portal/OrderDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/portal/quotes/[estimateNumber]/OrderDetail.tsx __tests__/app/portal/OrderDetail.test.tsx
git commit -m "feat(portal): OrderDetail layout component

Header → tracker → conditional invoice section → conditional shipping
section → line items table → action buttons → universal recovery footer
with errorId. Carrier-aware tracking URL helper covers UPS/FedEx/USPS/DHL
with a Google-search fallback for unknown carriers."
```

---

## Task 11 — Detail page (Server Component) + error boundary

**Files:**
- Create: `app/portal/quotes/[estimateNumber]/page.tsx`
- Create: `app/portal/quotes/[estimateNumber]/error.tsx`
- Test: `__tests__/app/portal/order-detail-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/app/portal/order-detail-page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitOrderDetail: vi.fn().mockResolvedValue({ success: true, remaining: 59 }),
}));
vi.mock("@/lib/zoho/books", async () => {
  const actual = await vi.importActual<typeof import("@/lib/zoho/books")>("@/lib/zoho/books");
  return {
    ...actual,
    getCachedOrderLifecycle: vi.fn(),
  };
});

import { currentUser } from "@clerk/nextjs/server";
import { rateLimitOrderDetail } from "@/lib/rate-limit";
import { getCachedOrderLifecycle } from "@/lib/zoho/books";
import OrderDetailPage from "@/app/portal/quotes/[estimateNumber]/page";

const partnerUser = {
  id: "user_1",
  publicMetadata: {
    role: "partner",
    zohoContactId: "cust_1",
    company: "Acme Optics",
    workflowProfile: "cash",
  },
  emailAddresses: [{ emailAddress: "p@acme.com" }],
};

describe("OrderDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("renders OrderDetail when partner + estimate exist", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
      estimate: {
        estimate_id: "est_1",
        estimate_number: "EST-001",
        customer_id: "cust_1",
        date: "2026-04-18",
        status: "sent",
        total: 100,
        sub_total: 100,
        currency_code: "USD",
        line_items: [],
      },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });

    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByRole("heading", { name: /EST-001/ })).toBeInTheDocument();
  });

  it("shows account-setup error when partner metadata is missing zohoContactId", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user_x",
      publicMetadata: {},
      emailAddresses: [],
    });
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Account setup incomplete/)).toBeInTheDocument();
  });

  it("shows rate-limit error when limiter returns success=false", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (rateLimitOrderDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, remaining: 0 });
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
  });

  it("renders 404 panel when estimate is null", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-NONE" }) });
    render(ui);
    expect(screen.getByText(/couldn't find that quote/i)).toBeInTheDocument();
  });

  it("renders soft-notice when getCachedOrderLifecycle throws", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("zoho 429"));
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Unable to load quote right now/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/portal/order-detail-page.test.tsx
```

Expected: FAIL — page module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/portal/quotes/[estimateNumber]/page.tsx
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { rateLimitOrderDetail } from "@/lib/rate-limit";
import { getCachedOrderLifecycle } from "@/lib/zoho/books";
import { getProfile } from "@/lib/portal/workflow";
import { OrderDetail } from "./OrderDetail";

export const metadata = {
  title: "Order | LOUISLUSO",
};

function makeErrorId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<React.ReactElement> {
  const errorId = makeErrorId();
  const user = await currentUser();
  if (!user) {
    return <ErrorShell message="Account setup incomplete, contact support." errorId={errorId} />;
  }

  const meta = isPartner(user.publicMetadata) ? user.publicMetadata : null;
  if (!meta?.zohoContactId) {
    return <ErrorShell message="Account setup incomplete, contact support." errorId={errorId} />;
  }

  const { success } = await rateLimitOrderDetail(user.id);
  if (!success) {
    return (
      <ErrorShell
        message="Too many requests. Please wait a moment and refresh. Limits reset every 5 minutes."
        errorId={errorId}
      />
    );
  }

  const { estimateNumber } = await params;

  let lifecycle;
  try {
    lifecycle = await getCachedOrderLifecycle(meta.zohoContactId, estimateNumber);
  } catch (err) {
    console.error(`getCachedOrderLifecycle failed [errorId=${errorId}]`, err);
    return (
      <ErrorShell
        message="Unable to load quote right now. Please try again in a moment."
        errorId={errorId}
      />
    );
  }

  if (!lifecycle) {
    return <NotFoundShell errorId={errorId} />;
  }

  const profile = getProfile(meta.workflowProfile);

  return (
    <OrderDetail
      estimate={lifecycle.estimate}
      salesOrder={lifecycle.salesOrder}
      invoice={lifecycle.invoice}
      shipment={lifecycle.shipment}
      profile={profile}
      errorId={errorId}
    />
  );
}

function ErrorShell({ message, errorId }: { message: string; errorId: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <p className="text-sm text-gray-400">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/portal/quotes"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            My Quotes
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
          <Link
            href="/quote-fallback"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Quote Without Login
          </Link>
        </div>
        <p className="mt-6 text-[11px] text-gray-600">Reference: <code>{errorId}</code></p>
      </div>
    </main>
  );
}

function NotFoundShell({ errorId }: { errorId: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h2 className="font-heading text-2xl text-white">We couldn&apos;t find that quote.</h2>
        <p className="mt-4 text-sm text-gray-400">It may still be processing.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/portal/quotes"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            View My Quotes
          </Link>
          <Link
            href="/eyeglasses"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
        </div>
        <p className="mt-6 text-[11px] text-gray-600">Reference: <code>{errorId}</code></p>
      </div>
    </main>
  );
}
```

```tsx
// app/portal/quotes/[estimateNumber]/error.tsx
"use client";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h2 className="font-heading text-2xl text-white">Something went wrong.</h2>
        <p className="mt-4 text-sm text-gray-400">
          Our system hit an unexpected error loading this quote.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Try again
          </button>
          <Link
            href="/portal/quotes"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            My Quotes
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-[11px] text-gray-600">
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/portal/order-detail-page.test.tsx
```

Expected: PASS for all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add app/portal/quotes/[estimateNumber]/page.tsx app/portal/quotes/[estimateNumber]/error.tsx __tests__/app/portal/order-detail-page.test.tsx
git commit -m "feat(portal): order detail page + error boundary

Server Component at /portal/quotes/[estimateNumber] handles auth + per-user
rate limit + cached lifecycle fetch + render. Three failure shells
(account-setup, rate-limit, soft-degrade) and a NotFound panel — every
state surfaces nav + support recovery affordances and an errorId
reference. Page-level error.tsx catches anything that escapes."
```

---

## Task 12 — Quote-fallback schema, API route, and form page

**Files:**
- Create: `lib/schemas/quote-fallback.ts`
- Create: `app/api/quote-fallback/route.ts`
- Create: `app/quote-fallback/page.tsx`
- Create: `app/quote-fallback/SubmittedConfirmation.tsx`
- Test: `__tests__/lib/schemas/quote-fallback.test.ts`
- Test: `__tests__/app/api/quote-fallback.test.ts`
- Test: `__tests__/app/quote-fallback/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/schemas/quote-fallback.test.ts
import { describe, it, expect } from "vitest";
import { quoteFallbackSchema } from "@/lib/schemas/quote-fallback";

describe("quoteFallbackSchema", () => {
  const valid = {
    email: "p@acme.com",
    name: "Alice",
    company: "Acme Optics",
    products: "SP1018 in C2 × 5",
  };

  it("accepts a minimal valid payload", () => {
    expect(quoteFallbackSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional phone + notes", () => {
    expect(
      quoteFallbackSchema.safeParse({ ...valid, phone: "555-1212", notes: "asap" }).success,
    ).toBe(true);
  });

  it("rejects bad email", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects empty company", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, company: "" }).success).toBe(false);
  });

  it("rejects empty product list", () => {
    expect(quoteFallbackSchema.safeParse({ ...valid, products: "" }).success).toBe(false);
  });
});
```

```typescript
// __tests__/app/api/quote-fallback.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/gmail", () => ({ sendEmail: sendEmailMock }));

import { POST } from "@/app/api/quote-fallback/route";

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/quote-fallback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/quote-fallback", () => {
  beforeEach(() => sendEmailMock.mockClear());

  const valid = {
    email: "p@acme.com",
    name: "Alice",
    company: "Acme Optics",
    products: "SP1018 in C2 × 5",
    notes: "asap please",
  };

  it("returns 400 on invalid JSON", async () => {
    const req = new Request("http://test/api/quote-fallback", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on schema failure with field-level errors", async () => {
    const res = await POST(makeRequest({ ...valid, email: "nope" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("details");
  });

  it("returns 200 + sends email on valid payload", async () => {
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe("cs@louisluso.com");
    expect(call.subject).toContain("Acme Optics");
    expect(call.body).toContain("SP1018 in C2 × 5");
  });

  it("returns 500 when Gmail send fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("gmail down"));
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(500);
  });
});
```

```tsx
// __tests__/app/quote-fallback/page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuoteFallbackPage from "@/app/quote-fallback/page";

describe("QuoteFallbackPage", () => {
  it("renders the form with required fields and a submit button", async () => {
    const ui = await QuoteFallbackPage();
    render(ui);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/products/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test __tests__/lib/schemas/quote-fallback.test.ts __tests__/app/api/quote-fallback.test.ts __tests__/app/quote-fallback/page.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

```typescript
// lib/schemas/quote-fallback.ts
import { z } from "zod";

export const quoteFallbackSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  company: z.string().min(1),
  phone: z.string().optional(),
  products: z.string().min(1),
  notes: z.string().optional(),
});

export type QuoteFallbackInput = z.infer<typeof quoteFallbackSchema>;
```

```typescript
// app/api/quote-fallback/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { quoteFallbackSchema } from "@/lib/schemas/quote-fallback";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = quoteFallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, name, company, phone, products, notes } = parsed.data;
  const subject = `Quote request from ${company}`;
  const text = [
    `New no-login quote request via /quote-fallback:`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    phone ? `Phone: ${phone}` : null,
    "",
    `Products requested:`,
    products,
    "",
    notes ? `Notes:` : null,
    notes ?? null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    await sendEmail({
      to: "cs@louisluso.com",
      subject,
      body: text,
    });
  } catch (err) {
    console.error("quote-fallback email failed", err);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

```tsx
// app/quote-fallback/SubmittedConfirmation.tsx
export function SubmittedConfirmation(): React.ReactElement {
  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="font-heading text-2xl text-white">Got it.</h2>
      <p className="mt-4 text-sm text-gray-400">
        Ken will reply within 24 hours.
      </p>
    </div>
  );
}
```

```tsx
// app/quote-fallback/page.tsx
"use client";
import { useState } from "react";
import { SubmittedConfirmation } from "./SubmittedConfirmation";

export default function QuoteFallbackPage(): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/quote-fallback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please email cs@louisluso.com directly.");
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      {submitted ? (
        <SubmittedConfirmation />
      ) : (
        <div className="mx-auto max-w-xl">
          <h1 className="font-heading text-3xl text-white">Quote without logging in</h1>
          <p className="mt-2 text-sm text-gray-500">
            Send Ken a list of what you want — he&apos;ll reply within 24 hours.
          </p>
          <form className="mt-10 space-y-5" onSubmit={onSubmit}>
            <Field label="Email" name="email" type="email" required />
            <Field label="Name" name="name" required />
            <Field label="Company" name="company" required />
            <Field label="Phone (optional)" name="phone" type="tel" />
            <Textarea label="Products" name="products" rows={4} required placeholder="e.g., SP1018 in C2 × 5, T-7241 in C8 × 10" />
            <Textarea label="Notes (optional)" name="notes" rows={3} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-bronze px-6 py-3 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit Quote Request"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-500">
            Or email{" "}
            <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
              cs@louisluso.com
            </a>{" "}
            directly.
          </p>
        </div>
      )}
    </main>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[2px] text-gray-400">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full border border-white/10 bg-[#111] px-4 py-2 text-sm text-white focus:border-bronze focus:outline-none"
      />
    </label>
  );
}

function Textarea({ label, name, rows, required, placeholder }: { label: string; name: string; rows: number; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[2px] text-gray-400">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full border border-white/10 bg-[#111] px-4 py-2 text-sm text-white focus:border-bronze focus:outline-none"
      />
    </label>
  );
}
```

> Note: the page is a Client Component. The page-test currently tests "renders form" — that exercise works because `pnpm test` runs jsdom and the `"use client"` directive doesn't change render behavior in the test runner. If the test environment ever balks, mark the test file with `// @vitest-environment jsdom` at the top (default already).

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test __tests__/lib/schemas/quote-fallback.test.ts __tests__/app/api/quote-fallback.test.ts __tests__/app/quote-fallback/page.test.tsx
```

Expected: PASS for all three.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/quote-fallback.ts app/api/quote-fallback/route.ts app/quote-fallback/page.tsx app/quote-fallback/SubmittedConfirmation.tsx __tests__/lib/schemas/quote-fallback.test.ts __tests__/app/api/quote-fallback.test.ts __tests__/app/quote-fallback/page.test.tsx
git commit -m "feat(portal): tier-2 fallback — public /quote-fallback form

No-auth public route + POST handler that Zod-validates the payload and
emails cs@louisluso.com via Gmail. Confirmation panel after submit.
Survives Zoho outages — only depends on Gmail. Tier 3 (mailto:) link
included on the form for the user's-mail-client-only floor."
```

---

## Task 13 — Webhook stub for future cache invalidation

**Files:**
- Create: `app/api/webhooks/zoho/route.ts`
- Test: `__tests__/app/api/webhooks-zoho-stub.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/api/webhooks-zoho-stub.test.ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/webhooks/zoho/route";

describe("POST /api/webhooks/zoho (stub)", () => {
  it("accepts and logs any payload, returns 200", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const req = new Request("http://test/api/webhooks/zoho", {
      method: "POST",
      body: JSON.stringify({ event: "estimate.accepted", data: { id: "x" } }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("returns 200 even on malformed JSON (Zoho retries on non-2xx)", async () => {
    const req = new Request("http://test/api/webhooks/zoho", {
      method: "POST",
      body: "{garbage",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/api/webhooks-zoho-stub.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/webhooks/zoho/route.ts
import { NextResponse } from "next/server";

// Stub for 5e. Logs every payload so we can see what Zoho actually sends.
// Real handlers (revalidateTag(orderLifecycleTag(...)) on accept/invoice/ship/pay)
// land in a future phase.
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = "<<unparseable>>";
  }
  console.info(JSON.stringify({ tag: "zoho_webhook_stub", body }));
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/api/webhooks-zoho-stub.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/zoho/route.ts __tests__/app/api/webhooks-zoho-stub.test.ts
git commit -m "feat(api): zoho webhook stub at /api/webhooks/zoho

Logs incoming payloads + returns 200 so Zoho retries don't pile up.
Real handlers (revalidateTag on lifecycle events) land in 5e."
```

---

## Task 14 — Slim former success page to a redirect

**Files:**
- Modify: `app/portal/quote/success/[estimateNumber]/page.tsx`
- Test: extend `__tests__/app/portal/quote-success.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// Replace the contents of __tests__/app/portal/quote-success.test.tsx with:
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import QuoteSuccessPage from "@/app/portal/quote/success/[estimateNumber]/page";

describe("QuoteSuccessPage (redirect shim)", () => {
  beforeEach(() => redirectMock.mockClear());

  it("redirects to /portal/quotes/[estimateNumber] with the URL-encoded number", async () => {
    await QuoteSuccessPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    expect(redirectMock).toHaveBeenCalledWith("/portal/quotes/EST-001");
  });

  it("URL-encodes special characters in the estimate number", async () => {
    await QuoteSuccessPage({ params: Promise.resolve({ estimateNumber: "EST 001/X" }) });
    expect(redirectMock).toHaveBeenCalledWith("/portal/quotes/EST%20001%2FX");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/portal/quote-success.test.tsx
```

Expected: FAIL — current implementation does not call `redirect()`.

- [ ] **Step 3: Write minimal implementation**

Overwrite `app/portal/quote/success/[estimateNumber]/page.tsx`:

```tsx
// app/portal/quote/success/[estimateNumber]/page.tsx
import { redirect } from "next/navigation";

export const metadata = {
  title: "Quote Submitted | LOUISLUSO",
};

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<never> {
  const { estimateNumber } = await params;
  redirect(`/portal/quotes/${encodeURIComponent(estimateNumber)}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/portal/quote-success.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/portal/quote/success/[estimateNumber]/page.tsx __tests__/app/portal/quote-success.test.tsx
git commit -m "refactor(portal): success page becomes redirect to canonical detail URL

/portal/quote/success/[id] now redirects to /portal/quotes/[id]. Preserves
any in-flight bookmarks/email links from prior submits while consolidating
on a single source of truth for order detail rendering."
```

---

## Task 15 — Update submit-handler client redirect

**Files:**
- Modify: `app/portal/quote/page.tsx` (line ~41-43)
- (No test change — covered transitively by the existing quote-page tests, which only assert success-state UI.)

- [ ] **Step 1: Update the redirect target**

In `app/portal/quote/page.tsx`, find the `router.push(...)` call (around line 41) that navigates to `/portal/quote/success/...` and change it to:

```typescript
      router.push(
        `/portal/quotes/${encodeURIComponent(data.estimateNumber)}`,
      );
```

- [ ] **Step 2: Run all portal-related tests to confirm nothing regresses**

```
pnpm test __tests__/app/portal/ __tests__/lib/portal/
```

Expected: PASS for all suites. The success-page tests now exercise the redirect shim from Task 14; the quote-page tests should be unaffected.

- [ ] **Step 3: Commit**

```bash
git add app/portal/quote/page.tsx
git commit -m "refactor(portal/quote): submit redirects to canonical /portal/quotes/[id]

Old success-page URL still works (it now redirects), but new submits land
straight on the canonical detail view."
```

---

## Task 16 — QuotesTable rows become detail-page links

**Files:**
- Modify: `app/portal/quotes/QuotesTable.tsx`
- Test: extend `__tests__/app/portal/QuotesTable.test.tsx`

- [ ] **Step 1: Write the failing test (append to existing file)**

```tsx
// Append to __tests__/app/portal/QuotesTable.test.tsx
import { render, screen } from "@testing-library/react";
import { QuotesTable } from "@/app/portal/quotes/QuotesTable";

describe("QuotesTable — row link to detail", () => {
  it("renders each Quote # cell as a Link to /portal/quotes/[number]", () => {
    render(
      <QuotesTable
        estimates={[
          {
            estimate_id: "est_1",
            estimate_number: "EST-001",
            date: "2026-04-18",
            status: "sent",
            total: 100,
            currency_code: "USD",
          },
        ]}
        page={1}
        hasMore={false}
      />,
    );
    const link = screen.getByRole("link", { name: "EST-001" });
    expect(link).toHaveAttribute("href", "/portal/quotes/EST-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test __tests__/app/portal/QuotesTable.test.tsx
```

Expected: FAIL — the cell currently renders plain text, not a Link.

- [ ] **Step 3: Write minimal implementation**

In `app/portal/quotes/QuotesTable.tsx`, change the `Quote #` cell render (around line 60) from:

```tsx
                <td className="py-3 text-gray-200">{e.estimate_number}</td>
```

to:

```tsx
                <td className="py-3 text-gray-200">
                  <Link
                    href={`/portal/quotes/${encodeURIComponent(e.estimate_number)}`}
                    className="hover:text-bronze"
                  >
                    {e.estimate_number}
                  </Link>
                </td>
```

`Link` is already imported from `next/link` at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

```
pnpm test __tests__/app/portal/QuotesTable.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/portal/quotes/QuotesTable.tsx __tests__/app/portal/QuotesTable.test.tsx
git commit -m "feat(portal): clicking a quote row in /portal/quotes opens the detail page"
```

---

## Task 17 — Final sweep: full test suite + tsc + manual smoke

**Files:** none — this is a verification + commit-the-milestone step.

- [ ] **Step 1: Run the full test suite**

```
pnpm test
```

Expected: all tests PASS. **If a test fails, fix the code, not the test** (per `feedback_test_failure_discipline.md`). The only legitimate test edits at this stage are if a deliberate, reviewed code change in this phase made an older assertion genuinely obsolete — and that edit ships in the same commit as the code change, with a note in the commit body.

- [ ] **Step 2: Run TypeScript strict check**

```
pnpm tsc --noEmit
```

Expected: no new errors. Pre-existing errors unrelated to 5d.2 (e.g., the `__tests__/app/api/dealers.test.ts` issues noted in earlier sessions) are out of scope.

- [ ] **Step 3: Manual smoke — local dev**

```
pnpm dev
```

In a separate terminal, walk through these scenarios in a browser. Each one corresponds to an item in `docs/portal-architecture.md` § 8.1. Confirm the partner-side experience matches the spec.

1. Sign in as a partner with at least one existing estimate. Visit `/portal/quotes`. Click a row → confirm you land on `/portal/quotes/[estimateNumber]`.
2. Confirm the tracker renders 5 stages, header shows `Quote #...` and `Submitted [date]`, line items table appears, footer shows mailto + fallback links + reference ID.
3. Visit `/portal/quotes/EST-DEFINITELY-FAKE` → confirm friendly 404 panel with the three recovery buttons.
4. Submit a fresh quote from `/portal/quote` → confirm post-submit redirect lands at `/portal/quotes/[new-estimate-number]` directly (not the old `/quote/success/...` URL).
5. Visit `/quote-fallback` while signed out → fill the form → submit → confirm the success message renders and an email lands in `cs@louisluso.com`.
6. Open browser devtools → throttle to "Offline" or block requests to `*.zoho.com` → reload `/portal/quotes/[id]` → confirm a soft notice renders rather than a stack trace.

If any step fails, halt and fix before continuing.

- [ ] **Step 4: Tag the milestone**

```bash
git tag phase-5d.2-complete -m "Phase 5d.2 — Order Detail page complete (spec: docs/superpowers/specs/2026-04-18-phase5d2-order-detail-design.md)"
```

- [ ] **Step 5: Push the milestone**

```bash
git push origin main
git push origin phase-5d.2-complete
```

---

## Self-Review

**1. Spec coverage check.** Walking the spec section-by-section:

| Spec section | Implementing task(s) |
|---|---|
| § 3.1 Route + redirect flow | T11 (page), T14 (success redirect), T15 (submit redirect), T16 (list link) |
| § 3.2 Workflow profiles | T1 (workflow.ts), T2 (PartnerMetadata schema) |
| § 3.3 Data orchestration (`getOrderLifecycle`, cache) | T5 (helpers), T6 (orchestrator), T7 (isolation), T8 (cache) |
| § 3.4 Auth + per-user rate limit | T3 (rateLimitOrderDetail), T11 (page wires it) |
| § 3.5 Zoho integration principles | Codified in `portal-architecture.md` § 4.1 (already committed); T4 implements item 9 (instrumentation) |
| § 4.1 New files (page, OrderDetail, StatusTracker, error.tsx, workflow.ts, quote-fallback files, webhook stub, schemas) | T1, T9, T10, T11, T12, T13 |
| § 4.2 Modified files (books, types, rate-limit, submit handler, success page, QuotesTable) | T2, T3, T5, T6, T8, T14, T15, T16; books `zohoFetch` instrumentation in T4 |
| § 4.3 Order Detail page sections (header, tracker, invoice, shipping, line items, actions, footer) | T10 (all sections + footer) |
| § 5 Status Tracker (visual states, profile order, mapping, dates, layout, a11y) | T9 |
| § 6 Fallback chain (T1/T2/T3) | T12 (T2 form + API), Tier 3 mailto wired in T10 + T11 footers |
| § 7 Error handling matrix (13 cases) + no-island recovery + universal footer + error boundary | T11 (5 of 13 explicit page-level cases), T10 (footer + mailto), T11 error.tsx (boundary), T6 (graceful degrade #9), T5+T6 (`safeParse` schema drift #10), T4 (logging foundation for #6/#7/#10/#11) |
| § 8 Observability tier 1 | T4 |
| § 9 Testing — unit, integration, page/component, manual QA, CI gate | All tasks include TDD; manual QA in T17 |
| § 10 Risks & open questions | Captured in spec; not directly implementable — verify with Ken before launch |

**No spec section is unimplemented.** A few cases in the 13-failure matrix (#6 wrong-customer, #12 cache-write-fails, #13 timeout) are protected by code that already lives in their respective layers (customer check in `getEstimateByNumber`, cache resilience in `unstable_cache`, timeouts in `fetch`); T7 pins #6 with a regression test, while #12/#13 are infrastructure-level and not testable from page tests without mocks the spec explicitly declines to invest in this phase.

**2. Placeholder scan.** Searched for "TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling" — no occurrences. Every code block is complete and runnable. Every command has expected output.

**3. Type consistency check.**

- `StageState` defined in T1 (workflow.ts), used in T9 (StatusTracker), T10 (OrderDetail) — same shape throughout.
- `LifecycleData` defined in T1, mapped from real Zoho types (`ZohoEstimateDetail`, `ZohoSalesOrderDetail`, `ZohoInvoiceForOrder`, `OrderShipment`) inside `OrderDetail` (T10) — that mapping is the conversion boundary; the consumer (`StatusTracker`) only sees `StageState[]`.
- `OrderLifecycle` defined in T6, consumed by `getCachedOrderLifecycle` (T8), the page (T11), and `OrderDetail` (T10).
- `WorkflowProfile`, `getProfile`, `WORKFLOW_PROFILES` consistent across T1 → T11.
- `quoteFallbackSchema` shape consistent across T12 schema, route, and form.

No type drift.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-phase5d2-order-detail.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for ~17-task plans like this; keeps each task's context clean and lets me catch drift between tasks before it compounds.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for your review.

Which approach?
