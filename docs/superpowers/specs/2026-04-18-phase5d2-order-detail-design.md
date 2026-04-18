# Phase 5d.2 — Order Detail Page Design

**Status:** Draft
**Date:** 2026-04-18
**Author:** Shawn + Claude (brainstorm session)
**Phase:** 5d.2 — B2B Portal: Order detail
**Predecessor:** 5d.1 — My Quotes (list view)
**Successors:** 5d.3 (Invoices + pay links), 5d.4 (Favorites), 5d.5 (Reorder)

## 1. Scope

Build the canonical detail page for a partner's quote/order at `/portal/quotes/[estimateNumber]`. Show full lifecycle status from submission through delivery via a UPS-style stage tracker, conditionally surface invoice and shipping sections as the order progresses, and provide always-on fallback paths so a buyer can never get stuck.

This phase also introduces:
- **Workflow profiles** (`cash` / `net30`) — per-partner configurable stage ordering, mirroring the existing `pricingPlanId` pattern
- **`getOrderLifecycle` orchestrator** — single Zoho call that fetches estimate + linked sales order + invoice + shipment
- **Tier 2 fallback form** at `/quote-fallback` — public, no-auth, posts directly to cs@ via Gmail API; works even if Zoho is fully down
- **Tier 1 observability instrumentation** — wraps `zohoFetch` with timing + status logging
- **Sister doc** `docs/portal-architecture.md` — Ken-readable living architecture document

## 2. Out of Scope

Deferred to other phases (documented for clarity):

| Item | Phase |
|---|---|
| Real PDF download (Zoho-rendered, branded) | 5d.3 (alongside invoice handling) |
| Invoices list view | 5d.3 |
| Stripe pay-link processing on the portal | 5d.3 |
| Favorites / reorder | 5d.4 / 5d.5 |
| Partner-side estimate edit / cancel | Not planned (Ken is source of truth post-submit) |
| Partial fulfillment / multi-shipment UI | Future phase, needs separate design |
| Refund / credit memo display | Future phase, rare for B2B |
| Webhook-driven cache invalidation | 5e (admin/webhook phase) |
| Support ticket form, ticket history | 5e (Support & Stickiness) |
| Email automations (estimate accepted/invoiced/shipped notifications) | 5e |
| Stale-quote alert digest to Ken | 5e |
| Server-side cart persistence | 5e |
| AI chatbot for FAQ deflection | Post-5e (requires ticket corpus first) |
| Vercel Observability Tier 2 dashboards | Adjacent task — turn on in Vercel UI; no code |
| Sentry / error tracking (Tier 4) | Future, when Ken wants it |
| `consignment` / `memo` / `net60` workflow profiles | Future — architecture supports adding without type changes |

## 3. Architecture

### 3.1 Route

- **New canonical detail route:** `app/portal/quotes/[estimateNumber]/page.tsx`
- **Modified submit handler:** `app/api/portal/quote/route.ts` redirects to `/portal/quotes/[estimateNumber]` instead of `/portal/quote/success/[estimateNumber]`
- **Modified former success page:** `app/portal/quote/success/[estimateNumber]/page.tsx` becomes a thin redirect to the canonical URL (preserves any in-flight bookmarks/email links from prior submits — zero broken URLs)
- **Modified list page:** `app/portal/quotes/QuotesTable.tsx` wraps the `Quote #` cell in `<Link href={`/portal/quotes/${e.estimate_number}`}>` so list rows become clickable

### 3.2 Workflow Profiles

A new typed map of profile id → `{ label, stages[] }` lives in `lib/portal/workflow.ts`. Each profile defines an ordered 5-stage sequence the partner sees on the tracker.

```ts
// lib/portal/workflow.ts
export type StageId =
  | "submitted"
  | "received"
  | "invoice_sent"
  | "payment_received"
  | "shipped";

export interface WorkflowProfile {
  id: "cash" | "net30";
  label: string;
  stages: StageId[]; // length 5, contains every StageId exactly once
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
```

`PartnerMetadata` schema (`lib/portal/types.ts`) adds an optional `workflowProfile` field:

```ts
export const partnerMetadataSchema = z.object({
  role: z.literal("partner"),
  zohoContactId: z.string().min(1),
  company: z.string().min(1),
  pricingPlanId: z.string().optional(),
  workflowProfile: z.enum(["cash", "net30"]).optional(), // NEW — defaults to "cash" when missing
});
```

Existing partners with no `workflowProfile` set fall through to `cash`. Zero migration required. Profile is set per-account in the Clerk dashboard for now (no admin UI yet — that's a future task).

Architecture supports adding `consignment`, `memo`, `net60` etc. by appending to `WORKFLOW_PROFILES` without changing any consumer code. Each new profile may also extend `StageId` if it has different stages (e.g., consignment adds `sales_reported`).

### 3.3 Data Orchestration

New helper in `lib/zoho/books.ts`:

```ts
export interface OrderLifecycle {
  estimate: ZohoEstimateDetail;
  salesOrder: ZohoSalesOrder | null;
  invoice: ZohoInvoice | null;
  shipment: { tracking_number: string; carrier: string; date: string } | null;
}

export async function getOrderLifecycle(
  customerId: string,
  estimateNumber: string,
): Promise<OrderLifecycle | null>;
```

Behavior:
1. Fetch estimate via existing `getEstimateByNumber(customerId, estimateNumber)`. If null → return null (caller renders 404).
2. In parallel via `Promise.all`:
   - Fetch sales order: `GET /salesorders?customer_id=X&reference_number=<estimateNumber>` → 0 or 1 result
   - (Conditional, after sales order resolves) Fetch invoice: `GET /invoices?salesorder_id=Y` → 0 or 1 result
3. Extract shipment from sales-order `packages[]` array (no separate fetch — already in payload). Returns first shipment with a `tracking_number` set; null otherwise.

**Linking conventions** (must be enforced by Ken's SOP):
- Sales Order's `reference_number` field MUST equal the source Estimate's `estimate_number`
- Invoice's `salesorder_id` field MUST point at the linked Sales Order
- Shipment lives inside the Sales Order's `packages[]` array (Zoho-native)
- Every fetch is scoped by `customer_id` for defensive isolation — a partner can never see another partner's data even if they guess an estimate number

**Cache layer** (`getCachedOrderLifecycle`):
- Tag: `order-lifecycle:${customerId}:${estimateNumber}` — per-order granularity
- TTL via `computeCacheTTL(stages)`:
  - Any in-flight stage (anything before `paid` and `shipped` both done) → 60s
  - All terminal (paid + shipped both done, OR declined, OR expired) → 15min
- Future invalidation hook: `app/api/webhooks/zoho/route.ts` will call `revalidateTag(...)` per-estimate on relevant Zoho events. Stub the route in 5d.2 (returns 200, logs payload), wire the actual handlers in 5e.

### 3.4 Auth + Per-User Rate Limit

Reuse the existing pattern from `app/portal/quotes/page.tsx`:
- Clerk `currentUser()` gate
- `isPartner(user.publicMetadata)` type guard
- New `rateLimitOrderDetail(user.id)` Upstash limiter — 60 req / 5min / user
- All standard error states render `<ErrorShell />` (existing pattern, see Error Handling below)

### 3.5 Zoho Integration Principles

This phase is the first to fully implement the principles codified in `portal-architecture.md` § "Zoho Integration Principles":

1. Cache before calling
2. Tier TTL by volatility (60s active, 15min terminal, 1hr immutable)
3. Parallelize within a single render
4. Use combined endpoints / `?include=` params where Zoho supports them
5. Per-user route rate limit at every Zoho-touching page
6. Webhook for invalidation when 5e ships
7. Graceful degradation on 429 / 5xx
8. Token refresh stays deduplicated (already handled in `lib/zoho/auth.ts`)
9. Observability: log every Zoho call with `{ endpoint, ms, status, cache: hit|miss }`
10. Never call Zoho from client-side code

Item 9 ships in this phase as Tier 1 instrumentation — see § 9 Observability.

## 4. Components

### 4.1 New files

| File | Type | Responsibility |
|---|---|---|
| `app/portal/quotes/[estimateNumber]/page.tsx` | Server Component (~150 lines) | Auth + rate limit + data fetch + render orchestration |
| `app/portal/quotes/[estimateNumber]/OrderDetail.tsx` | Server Component (~200 lines) | Layout: header → tracker → invoice section → shipping section → line items → actions |
| `app/portal/quotes/[estimateNumber]/StatusTracker.tsx` | Server Component (~120 lines) | Renders 5-stage tracker; pure presentational; takes `(profile, lifecycleData)` props |
| `app/portal/quotes/[estimateNumber]/error.tsx` | Client Component (~30 lines) | Page-level error boundary with recovery affordances |
| `lib/portal/workflow.ts` | Module (~80 lines) | `WORKFLOW_PROFILES` map, `getProfile()`, `computeStages()` (pure), `computeCacheTTL()` (pure) |
| `app/quote-fallback/page.tsx` | Server Component (~100 lines) | Public no-auth quote intake form (Tier 2 fallback) |
| `app/api/quote-fallback/route.ts` | API route (~60 lines) | POST handler: Zod validate → Gmail send to cs@ → log to sent-log.jsonl |
| `lib/schemas/quote-fallback.ts` | Zod schema (~30 lines) | Validation schema for fallback form payload |
| `app/api/webhooks/zoho/route.ts` | API route stub (~20 lines) | Stub handler — accepts payload, logs, returns 200. Real handlers in 5e. |

### 4.2 Modified files

| File | Change |
|---|---|
| `lib/zoho/books.ts` | Add `getOrderLifecycle`, `getCachedOrderLifecycle`, `OrderLifecycle` type. Wrap `zohoFetch` with timing/status instrumentation. |
| `lib/portal/types.ts` | Add `workflowProfile` to `partnerMetadataSchema`. |
| `lib/rate-limit.ts` | Add `rateLimitOrderDetail` (60 req / 5min / user). |
| `app/api/portal/quote/route.ts` | Redirect target: `/portal/quotes/[estimateNumber]` instead of `/portal/quote/success/[estimateNumber]`. |
| `app/portal/quote/success/[estimateNumber]/page.tsx` | Slim to redirect → `/portal/quotes/[estimateNumber]`. |
| `app/portal/quotes/QuotesTable.tsx` | Wrap `Quote #` cell in `<Link>` to detail page. |

### 4.3 Order Detail page sections (top-to-bottom)

1. **Header** — `Quote #EST-2026-04-18-001` (display heading), `Submitted Apr 18, 2026` (subtitle, gray)
2. **Status tracker** — 5 stages, profile-defined order, current state highlighted (see § 5)
3. **Invoice section** (conditional, appears once `invoice_sent` stage is done):
   ```
   Invoice #INV-2026-04-18-001
   Amount: $432.50  •  Due: May 18, 2026
   [ Pay Invoice ]   [ Download PDF ]
   ```
   - "Pay Invoice" → Stripe-hosted payment URL from Zoho's `invoice.payment_options.payment_gateways[]` if present
   - "Download PDF" → opens Zoho-hosted PDF (full Pay/Download via portal-served PDF lands in 5d.3)
   - Once `payment_received` stage is done: button row replaced by `✓ Paid {date}`
4. **Shipping section** (conditional, appears once `shipped` stage is done):
   ```
   Shipped Apr 24, 2026
   Tracking: 1Z999AA10123456784 (UPS)
   [ Track Package ]
   ```
   - "Track Package" opens carrier URL in new tab
   - Carrier inferred from tracking number prefix (UPS, FedEx, USPS, DHL); fallback "Tracking #" if unknown
5. **Line items table** (existing styling from current success page)
6. **Footer / actions row:**
   - `[ Print ]` (browser `window.print()`, `@media print` hides nav/footer)
   - `[ Email Ken about this quote ]` (mailto:cs@louisluso.com with prefilled subject `Question about quote {estimate_number}`)
   - `[ Browse Catalog ]` (link to `/eyeglasses`)
   - `[ My Quotes ]` (link to `/portal/quotes`)
7. **Universal recovery footer** (small, gray, on every page):
   ```
   Need help? Email cs@louisluso.com or [Submit a quote without logging in →]. Reference: req_a8f3k2
   ```
   No phone number is included — `lib/constants.ts` does not store one. If a phone number is added to constants in a future change, the footer copy can be extended; until then mailto + fallback form suffice.

## 5. Status Tracker

### 5.1 Visual states

```
●━━━━━━━━●━━━━━━━━●━━━━━━━━●━━━━━━━━○
Quote     Order     Invoice   Payment   Shipped
Submitted Received  Sent      Received  (pending)
Apr 18
```

| Symbol | State | Color |
|---|---|---|
| ● filled | Done | Bronze |
| ◉ pulsing | Current (in-flight) | Bronze with subtle pulse animation |
| ○ outlined | Pending | Gray |
| ✕ red X | Declined | Red |
| ⏱ gray clock | Expired | Gray |

Connecting line: bronze when both adjacent stages are done; gray when downstream is pending.

### 5.2 Profile-driven order

Tracker reads `partner.workflowProfile` (default `cash`). Stages render in profile-defined order:

**Cash partner:**
```
Submitted → Received → Invoice Sent → Payment Received → Shipped
```

**NET-30 partner:**
```
Submitted → Received → Shipped → Invoice Sent → Payment Received
```

The five stages and their data sources are identical across profiles; only the display order differs.

### 5.3 Stage → Zoho event mapping

Computed by `computeStages(profile, lifecycleData)`:

| Stage | Done when |
|---|---|
| `submitted` | Always — the estimate exists |
| `received` | `estimate.status === "accepted"` OR `salesOrder !== null` |
| `invoice_sent` | `invoice !== null` |
| `payment_received` | `invoice?.status === "paid"` (or `partially_paid` → in-progress) |
| `shipped` | `shipment !== null && shipment.tracking_number` |

**Terminal-not-success states** (handled by short-circuit):
- `estimate.status === "declined"` → stage 2 shows as "Declined" (red X), stages 3-5 hidden/grayed
- `estimate.status === "expired"` → stage 2 shows as "Expired" (gray clock), stages 3-5 hidden/grayed

### 5.4 Date stamps

Only stage 1 (Submitted) gets a date stamp from `estimate.date` directly. Stages 2-5 receive a date if Zoho exposes the relevant timestamp (e.g., `salesOrder.created_time`, `invoice.date`, `invoice.last_payment_date`, `shipment.shipment_date`); rendered below the stage label as small gray text. Missing dates → no subtitle (clean fallback, never broken UI).

### 5.5 Layout

- Desktop (≥640px): horizontal, 5 stages across, dates below labels
- Mobile (<640px): vertical, 5 rows, vertical line connecting stage circles, dates inline-right

### 5.6 Accessibility

- Tracker container: `role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={currentStageIndex + 1}`
- Each stage: `aria-label="{Stage name}, {state} {date if present}"` (e.g., `aria-label="Quote Submitted, completed Apr 18, 2026"`)
- Visual state never relied on color alone — symbols and text labels carry the same information

## 6. Fallback Chain (Always-On Quote Intake)

Three tiers, hardest-to-softest. Each tier survives failure of the previous.

### Tier 1 — Primary (existing, unchanged)
- Path: `/portal/quote` → POST `/api/portal/quote` → creates Zoho Estimate
- Requires Clerk auth + Zoho up

### Tier 2 — Fallback form (NEW in 5d.2)
- Path: `/quote-fallback` (public, no-auth)
- Form fields:
  - Email *
  - Name *
  - Company *
  - Phone (optional)
  - Product list (textarea, free-form: e.g., `SP1018 in C2 × 5, T-7241 in C8 × 10`) *
  - Notes (textarea, optional)
- Submit → POST `/api/quote-fallback`:
  - Zod validate
  - Gmail API send to `cs@louisluso.com` with subject `Quote request from {company}` and body containing all form fields
  - Append entry to `email/sent-log.jsonl` with `{ type: "fallback_quote", from, company, products, ts }` so we have an audit trail
  - Return 200 → confirmation page: "Got it — Ken will reply within 24 hours"
- **Zero Zoho dependency.** Works if Zoho is fully down.

### Tier 3 — Pure mailto: (NEW in 5d.2)
- Plain anchor in the universal recovery footer:
  ```html
  <a href="mailto:cs@louisluso.com?subject=Quote%20Request&body=...">
    Email Ken directly: cs@louisluso.com
  </a>
  ```
- Pre-fills subject + body template; if user has cart in localStorage, body includes their cart items
- **Works if Vercel/our serverless functions are down.** Mail client handles delivery, not us.

### 6.1 Where the fallbacks are linked

- Every error state in `/portal/*` includes both Tier 2 link and Tier 3 mailto
- Footer of `/portal/quote` (the primary cart): "Trouble submitting? Use our quote form"
- Footer of every product page: discoverable for prospects who can't or won't sign up
- Public site footer

## 7. Error Handling

Comprehensive failure modes with no-island recovery affordances.

| # | Failure | Cause | Handling |
|---|---|---|---|
| 1 | No auth | Clerk session missing | Clerk middleware redirects to sign-in |
| 2 | Auth but not a partner | No `role: "partner"` metadata | `<ErrorShell>` w/ "Account setup incomplete" + `[Contact Support]` mailto + `[Back to Dashboard]` |
| 3 | Partner but no `zohoContactId` | Onboarding incomplete | Same as #2. Logged to observability so we can find broken accounts |
| 4 | User hits rate limit | >60 req / 5min on detail page | `<ErrorShell>` w/ "Too many requests, please wait a moment and refresh" + `[Refresh]` button + `[Back to My Quotes]` link + "Limits reset every 5 minutes" copy |
| 5 | Estimate not found in Zoho | Bad URL, deleted estimate | Friendly 404 + `[View My Quotes]` + `[Browse Catalog]` + `[Contact Support]` + Tier 2 fallback link |
| 6 | Estimate exists but belongs to another customer | Defensive — partner guesses URL | Same 404 (don't reveal existence). Logged with `{ partnerId, estimateNumber, actualCustomerId }` — security signal |
| 7 | Zoho returns 429 | We exceeded org quota | `getOrderLifecycle` returns last-cached value (even if stale past TTL) → render with soft notice "Some details may be slightly delayed". Logged. |
| 8 | Zoho returns 5xx | Zoho outage | Same as #7 |
| 9 | Partial Zoho data | Network blip mid-orchestration | Render with `{ estimate, salesOrder: null, ... }`. Tracker shows what's known + soft notice. No hard failure. |
| 10 | Zod parse failure on Zoho response | Schema drift | Switch to `.safeParse()` and on failure log full payload + return null (treat as not-found). Drift visible in logs without breaking partners. |
| 11 | Token refresh fails | OAuth creds revoked / Zoho auth outage | Soft notice. Future Sentry alert (Tier 4). |
| 12 | Cache write fails | Vercel KV / Upstash outage | `unstable_cache` falls through to direct fetch on read; write failures don't block render. Logged. |
| 13 | Network timeout | Slow Zoho response | `zohoFetch` 15s timeout; treated like 5xx → soft notice |

### 7.1 No-island rule

> Every error state must include at least one navigation action and one support action. Never render an error message without a way forward.

Codified in `portal-architecture.md`, applies to every portal page in 5d.2 onward.

### 7.2 Universal recovery footer

Present on every error variant:
```
Need help? Email cs@louisluso.com or [Submit a quote without logging in →]. Reference: req_a8f3k2
```

`error_id` is a short random ID (e.g., `req_a8f3k2`) injected at error time + logged with full context. When a partner emails support quoting that ID, support can grep logs for the exact failed request.

### 7.3 Page-level error boundary

`app/portal/quotes/[estimateNumber]/error.tsx` (Client Component) catches any unhandled crash inside `OrderDetail`. Renders the same `ErrorShell` with `[Try again]` (Next.js `reset()`), `[Back to My Quotes]`, `[Contact Support]`, and the `error_id`.

## 8. Observability (Tier 1)

Wraps `zohoFetch` in `lib/zoho/client.ts` with structured logging:

```
{ts: "2026-04-18T14:32:01.234Z", endpoint: "/books/v3/estimates/123", method: "GET",
 status: 200, ms: 142, cache: "miss", customerId: "X", route: "/portal/quotes/[id]"}
```

One log line per call. Goes to `console.log` → captured automatically in Vercel function logs. Greppable in Vercel dashboard.

**Tier 2** (Vercel-native dashboards) is a separate task — turn on Vercel Observability + Speed Insights in the project settings, no code changes. Reference in `portal-architecture.md`.

**Tier 3** (internal `/admin/observability` page) and **Tier 4** (Sentry, uptime monitoring) are deferred to future phases.

## 9. Testing

Coverage floor 90% on new files (project policy from `CLAUDE.md`). Test types per project standards: Vitest + RTL.

### 9.1 Unit tests

| File | Coverage |
|---|---|
| `__tests__/portal/workflow.test.ts` | `getProfile()` defaults; `computeStages()` for both profiles across all combinations of pending/accepted/declined/expired/invoiced/paid/shipped — full truth table |
| `__tests__/portal/workflow-cache-ttl.test.ts` | `computeCacheTTL()` returns 60s for in-flight, 15min for terminal |

### 9.2 Integration tests

| File | Coverage |
|---|---|
| `__tests__/zoho/books-order-lifecycle.test.ts` | Happy path (all 4 objects), partial data paths, failure paths (estimate not found, mid-fetch error returns partial), Zod schema drift handling |
| `__tests__/zoho/books-customer-isolation.test.ts` | Confirms `getOrderLifecycle` rejects when estimate's `customer_id ≠ requested customerId` (security regression guard) |

### 9.3 Page / component tests

| File | Coverage |
|---|---|
| `__tests__/app/portal/order-detail-page.test.tsx` | Renders for valid partner+estimate; 404 for not-found; ErrorShell for missing zohoContactId; soft-notice for partial Zoho data; correct workflow profile applied from metadata |
| `__tests__/app/portal/status-tracker.test.tsx` | All visual states (done/current/pending/declined/expired); stages render in profile-defined order; mobile vs desktop; accessibility roles + aria-labels |
| `__tests__/app/portal/order-detail-actions.test.tsx` | Print triggers `window.print()`; mailto has correct prefilled subject/body; fallback links present |
| `__tests__/app/portal/quotes-table-link.test.tsx` | Quote # cell renders as `<Link>` to `/portal/quotes/[estimateNumber]` |
| `__tests__/app/quote-fallback/page.test.tsx` | Public access (no auth required); Zod validation rejects bad input; success POST renders confirmation |
| `__tests__/app/api/quote-fallback.test.ts` | Valid payload sends Gmail + logs to sent-log.jsonl + returns 200; invalid payload returns 400 with field-level errors; Gmail send failure returns 500 with retry-able shape |

### 9.4 Manual QA scenarios

Documented in `portal-architecture.md` § "Manual QA scenarios — 5d.2". Numbered checklist (cash happy path, NET-30 happy path, declined, expired, not-found, wrong-customer, rate limit, Zoho partial outage, fallback form, mailto fallback). See architecture doc for full text.

### 9.5 Test discipline

When a test fails, the **default response is to fix the code**, not the test. Test assertions are only updated when:
1. The behavior the test asserted is genuinely obsolete
2. The change is deliberate (intended removal/rename/shape change)
3. The test edit is in the same review/PR as the code change

This applies to all test types (unit, integration, page/component, manual QA) and all phases. Codified in `portal-architecture.md` § "Test discipline".

### 9.6 CI gate

- All Vitest tests pass: `pnpm test`
- TypeScript strict, no errors: `pnpm tsc --noEmit`
- Coverage 90% floor on new files

## 10. Risks & Open Questions

### 10.1 Risks

- **Ken SOP discipline.** The whole tracker depends on Ken setting `reference_number` correctly when converting estimate → sales order, and creating shipments + invoices in Zoho. If he skips steps or uses wrong references, the partner sees a stalled tracker. **Mitigation:** the SOP must be documented in `portal-architecture.md` § "Ken's Zoho SOP" and walked through with him before launch. The 5e stale-quote alert system is the systemic backstop.
- **Zoho API drift.** Zoho occasionally adds/removes/renames fields. The `.safeParse()` change in error handling #10 makes drift visible without breaking partners, but doesn't auto-fix.
- **Cache staleness window.** Until 5e webhooks land, partners see Ken-side updates within 60s. Acceptable for launch but must be flagged in `portal-architecture.md`.
- **Pay-link availability.** The "Pay Invoice" button depends on Zoho exposing a Stripe-hosted payment URL on the invoice payload. Needs verification against a real invoice — if Zoho doesn't return a public URL, we may need to generate one via the invoice payment endpoint or defer the button to 5d.3.

### 10.2 Open questions

- **Confirm with Ken** that the 5-stage tracker matches his actual workflow sequence and that the reference_number convention is workable for him.
- **Confirm with Ken** that "Order Sent" matches his preferred terminology (vs "Shipped" — both used in this doc; pick one for consistency).
- **NET-30 partner exists?** Need at least one current account flagged `workflowProfile: "net30"` to QA the alternate path against real data.
- **Tracking-number → carrier inference.** Build a small helper or pull from a library? If carrier is captured separately on the Zoho `package` payload, prefer that.

## 11. Effort estimate

Rough-cut totals (implementation, not including review cycles):

| Area | Hours |
|---|---|
| `lib/portal/workflow.ts` + tests | 1 |
| `lib/zoho/books.ts` orchestrator + cache + tests | 2 |
| `lib/portal/types.ts` + `lib/rate-limit.ts` updates | 0.5 |
| Order detail page + OrderDetail + StatusTracker + tests | 3 |
| Quote fallback form + API + Zod + tests | 1.5 |
| Webhook stub | 0.25 |
| Modified files (success page redirect, list table link, submit handler) | 0.5 |
| zohoFetch instrumentation | 0.5 |
| Error boundary + soft notices wired across 13 cases | 1 |
| `portal-architecture.md` co-deliverable | 2 |
| Manual QA pass | 1.5 |
| **Total** | **~13.75 hours** |

Assumes no novel infra discoveries. Buffer to 16-18 hours for safety.
