# Phase 5d.1: My Quotes — Design Spec

## Overview

Partners can view a list of all quotes they have submitted, with status and total. Reads from Zoho Books Estimates. First chunk of Phase 5d (Orders/Favorites).

Closes the loop on 5c: after a partner submits a quote, they can come back and see it.

---

## Scope

**In scope:**
- `/portal/quotes` — list page showing a partner's submitted estimates
- Columns: Quote # · Date · Status · Total
- Status labels translated to partner-friendly copy
- Dashboard card + UserMenu item for navigation
- Empty state
- Error state
- Pagination (20/page, Prev/Next)
- Per-user rate limit (Upstash, 30 req / 5 min)
- Response cache via `unstable_cache` (60s TTL, tag-keyed per partner)
- **Cross-feature — 5c submit flow refactor:**
  - `POST /api/portal/quote` calls `revalidateTag(\`quotes-${customerId}\`)` after `createEstimate` succeeds
  - `/portal/quote` page no longer renders an inline "Quote Submitted" view; on success it clears the cart and `router.push`-es to `/portal/quote/success/<estimateNumber>`
  - New success page at `/portal/quote/success/[estimateNumber]` shows a full line-item summary + action buttons

**Not in scope (later chunks):**
- Quote/order detail page (5d.2)
- Invoice list + pay links (5d.3)
- Favorites (5d.4)
- Reorder (5d.5)

---

## Architecture

**Page:** `/portal/quotes` — Server Component, SSR, no client JS.

**Auth + request flow:**
1. `currentUser()` from Clerk. If null → redirect `/sign-in`.
2. `isPartner(user.publicMetadata)` — if false → redirect `/pending-approval`.
3. Read `zohoContactId` from `user.publicMetadata`. If missing → render error state "Account setup incomplete, contact support." (invariant from 5a, defensive).
4. **Rate-limit check:** key by Clerk `userId`, 30 req / 5 min, via `lib/rate-limit.ts` (new `quotesListLimiter`). If exceeded → render rate-limit error: "Too many requests. Please wait a moment and refresh."
5. Read `searchParams.page` → parse to a positive integer; default `1`; clamp invalid values back to `1`.
6. Fetch page via `getCachedEstimatesForContact(zohoContactId, { page, perPage: 20 })` (cache wrapper over `getEstimatesForContact`).
7. Render table + Prev/Next controls (or empty state if first page is empty).

**Data flow:** Clerk session → rate limit → `zohoContactId` + page → `unstable_cache` (hit or miss → Zoho Books API) → `{ estimates, hasMore, page }` → server-rendered table + nav.

The list page does not try to reconcile "just submitted" state. The 5c submit flow owns the confirmation moment via the success page; by the time the partner clicks the "My Quotes" action on the success page, the cache has been invalidated and the list reflects the new quote.

---

## Data Layer

Add to `lib/zoho/books.ts`:

```typescript
export interface ZohoEstimateListItem {
  estimate_id: string;
  estimate_number: string;
  date: string;           // ISO YYYY-MM-DD
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  total: number;
  currency_code: string;
}

export interface EstimateListOptions {
  page?: number;          // 1-indexed, default 1
  perPage?: number;       // default 20, max 200 (Zoho cap)
}

export interface EstimateListResult {
  estimates: ZohoEstimateListItem[];
  page: number;
  hasMore: boolean;
}

export async function getEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult>
```

Calls `GET /books/v3/estimates?customer_id={id}&sort_column=date&sort_order=D&page={page}&per_page={perPage}`. Returns newest-first. `hasMore` is read from Zoho's `page_context.has_more_page`. `page` is echoed back so the caller can trust what Zoho actually returned (handles the case where a bad page number falls past the end).

**On Zoho "draft" vs "sent":**

Zoho distinguishes `draft` (created but not sent) from `sent` (estimate email has been dispatched from Zoho). These are internal Zoho lifecycle states and do not match the partner's mental model.

In our 5c flow, `POST /api/portal/quote` calls `createEstimate` without `send=true`, so **every partner-submitted quote lands in Zoho as `draft`**. It only transitions to `sent` when Ken (or a Zoho workflow) sends the estimate email. From the partner's perspective, both states mean the same thing: *"I submitted this, Ken hasn't confirmed stock yet."*

**Decision:** treat `draft` and `sent` as the same partner-facing state. Both map to the label **"Pending Review"**. No filter — both are returned in the list.

Ken's own WIP drafts (created manually in Zoho before a partner exists, or for a different customer) are scoped out naturally by the `customer_id` query param. If Ken drafts a hypothetical quote directly under a partner's contact, the partner will see it — that is the expected, acceptable behavior, since Ken is not expected to create speculative drafts under partner contacts.

**Response validation:** parses the Zoho response through a Zod schema at runtime (the `estimates` array + each item's required fields). On parse failure, throws an error that the page layer maps to the generic error state. This adds minor runtime cost but prevents malformed data from reaching the UI; matches the safety bar appropriate for partner-facing server code.

**Cache wrapper** — new helper in same file:

```typescript
export function getCachedEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult>
```

Wraps `getEstimatesForContact` with Next.js `unstable_cache`:
- **Key parts:** `["zoho-estimates-list"]`
- **Cache entries** are keyed automatically by the underlying function's arguments (`customerId`, `page`, `perPage`), so every partner + page combination gets its own entry
- **Tags:** `["zoho-estimates-list"]` (single static tag — Next.js requires `tags` to be a static `string[]`, no per-customer dynamic tagging available)
- **Revalidate:** 60 seconds

Invalidation: 5c's `POST /api/portal/quote` calls `revalidateTag("zoho-estimates-list")` after `createEstimate` succeeds. This invalidates every cached quote list, not just the submitting partner's. Acceptable because:
- Invalidation is rare (every partner submit = one invalidation)
- Cached entries just refetch from Zoho on next access (no error — just a cache miss)
- We avoid maintaining a separate per-customer tag structure in Redis
- At B2B scale (low concurrent partners), the extra Zoho calls are negligible

Ken-side status changes in Zoho (draft→sent, sent→accepted) are not invalidated by us; those propagate within the 60s TTL, which is acceptable given those transitions take hours/days.

**Estimate detail by number** — new helper in same file (for the success page):

```typescript
export interface ZohoEstimateDetail {
  estimate_id: string;
  estimate_number: string;
  customer_id: string;
  date: string;
  status: ZohoEstimateListItem["status"];
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
): Promise<ZohoEstimateDetail | null>
```

Implementation: calls `GET /books/v3/estimates?customer_id={id}&estimate_number={number}` (Zoho supports filtering list responses by `estimate_number`). Takes the first match, re-fetches via `GET /books/v3/estimates/:id` to get full `line_items`, validates with Zod, and returns. Returns `null` when no match is found (distinct from throwing, which signals an API error).

The `customerId` filter enforces isolation — a partner cannot fetch another partner's estimate by guessing the number. If Zoho returns an estimate whose `customer_id` does not match the caller-supplied `customerId` (shouldn't happen given the filter, but defensive), the function treats it as not-found and returns `null`.

**Status mapping** — new helper in same file:

```typescript
export function partnerLabelForEstimateStatus(
  status: ZohoEstimateListItem["status"] | string,
): string;
```

Returns:
| Zoho status | Partner label |
|---|---|
| `draft` | "Pending Review" *(partner-submitted; awaiting Ken's review in Zoho)* |
| `sent` | "Pending Review" *(Ken has dispatched the estimate email; partner still waiting on confirmation)* |
| `accepted` | "Confirmed" |
| `declined` | "Declined" |
| `expired` | "Expired" |
| `invoiced` | "Order Placed" |
| anything else | the raw status string, title-cased as fallback |

---

## UI

### Page Layout

Dark theme matching the rest of the portal (`bg-[#0a0a0a]`, bronze accents).

```
┌─ Header ─────────────────────────────────┐
│  My Quotes                               │
│  Review your submitted quotes and orders │
└──────────────────────────────────────────┘

┌─ Table ──────────────────────────────────────────┐
│  Quote #    Date          Status         Total   │
│  EST-00123  Apr 12, 2026  Pending Review $1,140  │
│  EST-00122  Apr 08, 2026  Confirmed      $760    │
│  EST-00119  Mar 28, 2026  Order Placed   $2,420  │
└──────────────────────────────────────────────────┘
```

### Status Pill Colors

| Label | Tailwind classes |
|---|---|
| Pending Review | `bg-white/5 text-gray-300` |
| Confirmed | `bg-bronze/15 text-bronze` |
| Order Placed | `bg-green-500/15 text-green-400` |
| Declined | `bg-red-500/10 text-red-400` |
| Expired | `bg-white/5 text-gray-500` |

(Partners never see a "Draft" pill — `draft` is mapped to "Pending Review" per the status table above.)

### Rows

Not clickable in 5d.1. Detail links activate when 5d.2 lands.

### Pagination Controls

Below the table:

```
                    ← Previous    Page 2    Next →
```

- "Previous" hidden on page 1; "Next" hidden when `hasMore === false`
- Both render as `<Link>` components (plain anchors, no client JS) bound to `/portal/quotes?page={n}`
- "Page N" is plain text (no page-number list — keeps scope minimal, works for arbitrary total counts)
- Omitted entirely when `page === 1 && !hasMore` (everything fits on one page)

### Empty State

Shown when `page === 1 && estimates.length === 0`:

```
You haven't submitted any quotes yet.
[Browse Collections] → /eyeglasses
```

If the user manually jumps to a page that falls past the end (e.g., `?page=50` with only 5 quotes), Zoho will return an empty array with `hasMore: false`. In that case, render a lightweight "No quotes on this page. [Back to page 1]" instead of the first-time empty state.

**No "just submitted" variant here.** The success page owns the confirmation moment; by the time a partner arrives at `/portal/quotes` via the success page's "My Quotes" action, the cache has been invalidated and the estimate is returned by Zoho. If for some reason the Zoho read is still stale (unlikely — Zoho is read-after-write consistent within an org), the partner will see the first-time empty state, refresh, and the row will appear. Acceptable edge-case behavior.

### Error State

```
Unable to load quotes right now. Please try again in a moment.
```

Logged server-side via `console.error` with context. No Zoho error detail leaked to the UI.

### Rate-Limit State

Shown instead of the table when the per-user limit is exceeded:

```
Too many requests. Please wait a moment and refresh.
```

Distinct copy from the generic Zoho error so a developer reading logs and screen-sharing with a partner can tell them apart.

### Responsive

Mobile (≤640px) collapses to stacked 2-column cards:
- Top row: Quote # · Total
- Bottom row: Date · Status

---

## Quote Success Page (Cross-feature with 5c)

### Route

`/portal/quote/success/[estimateNumber]` — Server Component. `estimateNumber` is the Zoho-assigned ID like `EST-00123`.

### Auth

Same checks as other portal pages:
1. `currentUser()` → redirect `/sign-in` if null
2. `isPartner(publicMetadata)` → redirect `/pending-approval`
3. Missing `zohoContactId` → render the same "Account setup incomplete" error state used on `/portal/quotes`

### Data fetch

Calls `getEstimateByNumber(zohoContactId, estimateNumber)` (new helper — see Data Layer additions below). This returns a full estimate with line items. The helper scopes by `zohoContactId` so a partner cannot view another partner's estimate just by guessing a number.

If the lookup returns no match (estimate not found, belongs to another partner, or typo in URL):
- Render: "We couldn't find that quote. It may still be processing. **[View My Quotes]**"
- Log `console.warn` with the partner's `zohoContactId` + `estimateNumber` (helps spot if this ever fires in practice)

If the Zoho call throws: generic error state with the same copy used by `/portal/quotes`.

### Layout

Dark theme, matching portal aesthetic.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              ✓  Quote Submitted                  │
│                                                  │
│        Quote EST-00123 — Ken will review         │
│         and confirm availability shortly.        │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Product   Color       Qty    Unit   Total │  │
│  │  SG-1011   C1 — Black   5  $76.00 $380.00  │  │
│  │  SG-1011   C2 — Matte  10  $76.00 $760.00  │  │
│  │  LC-9018   C1 — Gold    3  $81.00 $243.00  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│          18 items · Subtotal $1,383.00           │
│                                                  │
│  [Browse Catalog]  [My Quotes]  [Dashboard]      │
│                                                  │
└──────────────────────────────────────────────────┘
```

Action buttons:
- **Browse Catalog** → `/eyeglasses`
- **My Quotes** → `/portal/quotes`
- **Dashboard** → `/portal`

All three rendered as `<Link>` elements, bronze outline styling matching the existing portal button patterns.

### File

`app/portal/quote/success/[estimateNumber]/page.tsx` — Server Component, no client JS.

---

## Navigation

### Dashboard card (`app/portal/page.tsx`)

Rename the placeholder card:
- Title: "View Orders" → "My Quotes"
- Description: "Review submitted quotes and their status"
- `href`: `/portal/quotes`
- `enabled: true`

### UserMenu dropdown (`app/components/UserMenu.tsx`)

Add a new item above "Account Settings":
- Label: "My Quotes"
- Link: `/portal/quotes`

---

## Error Handling

| Failure mode | Behavior |
|---|---|
| User not signed in | Redirect `/sign-in` (existing portal pattern) |
| User not a partner | Redirect `/pending-approval` (existing portal pattern) |
| Partner missing `zohoContactId` | Render error: "Account setup incomplete, contact support." |
| Rate limit exceeded | Render rate-limit state: "Too many requests. Please wait a moment and refresh." |
| Zoho API error (any 4xx/5xx) | Render error: "Unable to load quotes right now. Please try again in a moment." |
| Zoho returns malformed data | Zod parse failure inside `getEstimatesForContact`; page treats it as an API error |
| `revalidateTag` throws in 5c | Log but do not roll back — estimate was created successfully; worst case cache is stale until TTL expires |

All server-side errors logged with `console.error`, including the `zohoContactId` and a short error message. No Zoho response body leaked to the client.

---

## Rate Limit + Cache (In Scope)

**Per-user rate limit:**
- Upstash sliding-window: 30 requests per 5 min per Clerk `userId`
- Added as `quotesListLimiter` in `lib/rate-limit.ts` (matches the `dealerContactLimiter` pattern)
- Runs before the cache lookup so abuse cannot hammer even cached reads
- Key format: `quotes-list:${userId}`

**Response cache:**
- `unstable_cache` wrapper around `getEstimatesForContact`
- Key parts: `["zoho-estimates-list"]` (per-customer keying is handled via the wrapped function's arguments)
- Tags: `["zoho-estimates-list"]` (static; Next.js does not support dynamic tag functions in `unstable_cache`)
- TTL: 60s

**Invalidation from 5c:**
- `POST /api/portal/quote` calls `revalidateTag("zoho-estimates-list")` after `createEstimate` succeeds
- Wrapped in a try/catch — a revalidation error must not roll back the quote submission (same pattern as the email send in 5c)
- Partner navigating to `/portal/quotes` post-submit sees fresh data
- Side effect: any other partner whose cache was warm will also get a cache miss. Acceptable at B2B scale.

**Deferred (future escalation if needed):**
- Background sync to our own store (Postgres/KV) — revisit only if active partner count exceeds ~100 or Zoho call volume approaches the daily cap

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/portal/quotes/page.tsx` | Server component — auth + rate limit + fetch + render |
| `app/portal/quotes/QuotesTable.tsx` | Presentational table (no client JS) |
| `app/portal/quote/success/[estimateNumber]/page.tsx` | Post-submit summary page with line items + actions |
| `__tests__/app/portal/quotes.test.tsx` | List page rendering: rows, empty, error, pagination, rate limit |
| `__tests__/app/portal/quote-success.test.tsx` | Success page: rendering, not-found state, auth redirects |
| `__tests__/lib/zoho/books-estimates-list.test.ts` | `getEstimatesForContact` + status mapper |
| `__tests__/lib/zoho/books-estimate-by-number.test.ts` | `getEstimateByNumber` — happy path, not-found, cross-partner protection |

### Modified Files

| File | Change |
|------|--------|
| `lib/zoho/books.ts` | Add `getEstimatesForContact`, `getCachedEstimatesForContact`, `getEstimateByNumber`, `partnerLabelForEstimateStatus`, plus the interfaces (`ZohoEstimateListItem`, `EstimateListOptions`, `EstimateListResult`, `ZohoEstimateDetail`) |
| `lib/rate-limit.ts` | Add `quotesListLimiter` (30 req / 5 min sliding window, keyed by `userId`) — mirrors the `dealerContactLimiter` pattern |
| `app/portal/page.tsx` | Enable "My Quotes" card, rename from "View Orders", update description + href |
| `app/components/UserMenu.tsx` | Add "My Quotes" dropdown item above Account Settings |
| `app/portal/quote/page.tsx` | Replace inline "Quote Submitted" success view with `router.push("/portal/quote/success/${estimateNumber}")` after a successful POST; cart still cleared before redirect |
| `app/api/portal/quote/route.ts` | Call `revalidateTag(\`quotes-${zohoContactId}\`)` after `createEstimate` succeeds; wrap in try/catch so a revalidation failure does not roll back the submission (same pattern as the best-effort email send) |

No new dependencies.

---

## Testing

### Unit Tests

**`__tests__/lib/zoho/books-estimates-list.test.ts`:**
- `getEstimatesForContact` calls `zohoFetch` with the correct URL + params (`customer_id`, `sort_column=date`, `sort_order=D`, `page`, `per_page`)
- Defaults to `page=1`, `perPage=20` when options are omitted
- Returns `{ estimates, page, hasMore }`; `estimates` includes `draft` rows (no filter)
- Reads `hasMore` from Zoho's `page_context.has_more_page`
- Throws when Zoho returns malformed data (Zod parse failure)
- Propagates Zoho errors (doesn't swallow)
- `partnerLabelForEstimateStatus` maps each of the 6 known statuses correctly
- `partnerLabelForEstimateStatus` returns "Pending Review" for both `draft` and `sent`
- `partnerLabelForEstimateStatus` returns title-cased fallback for unknown status

**`__tests__/lib/zoho/books-estimate-by-number.test.ts`:**
- Happy path: finds estimate by number, returns detail with `line_items` populated
- Returns `null` when Zoho's filtered list returns zero matches
- Returns `null` when the match's `customer_id` does not equal the caller-supplied `customerId` (defensive isolation check)
- Throws when Zoho returns malformed data (Zod parse failure)
- Propagates Zoho errors (doesn't swallow)
- Makes both calls (list-by-number, then detail-by-id) and passes the correct params to each

### Component Tests

**`__tests__/app/portal/quotes.test.tsx`:**
- Renders table with sample estimate rows (3 different statuses); each row shows Quote #, formatted date, partner status label, formatted total
- Renders first-time empty state with "Browse Collections" link when page 1 returns no rows
- Renders "back to page 1" empty state when a later page returns no rows
- Renders generic error state when `getEstimatesForContact` throws
- Renders rate-limit state when the limiter returns `success: false`
- Status pill element carries the expected class per status (e.g., "Confirmed" row has `text-bronze`)
- Non-partner user → redirects to `/pending-approval` (mock Clerk)
- Unauthenticated user → redirects to `/sign-in`
- Partner missing `zohoContactId` → renders account setup error (distinct copy from generic Zoho error)
- Invalid `?page=` values (non-numeric, negative, zero) clamp to page 1
- Pagination controls hidden entirely on single-page result (`page === 1 && !hasMore`)
- "Previous" hidden on page 1; "Next" hidden when `hasMore === false`
- Prev/Next links point to the correct `?page=` target

**`__tests__/app/portal/quote-success.test.tsx`:**
- Renders heading "Quote Submitted" with the estimate number from the route param
- Renders line items table with product name, color/SKU, qty, unit rate, line total
- Renders subtotal + item count summary
- Renders three action buttons linking to `/eyeglasses`, `/portal/quotes`, `/portal`
- Renders "couldn't find that quote" fallback with a "View My Quotes" link when `getEstimateByNumber` returns `null`
- Renders generic error state when `getEstimateByNumber` throws
- Non-partner user → redirects to `/pending-approval`
- Unauthenticated user → redirects to `/sign-in`
- Partner missing `zohoContactId` → renders account setup error

**Existing test to update — `__tests__/app/api/portal/quote.test.ts`:**
- Add assertion that `revalidateTag` is called with `"zoho-estimates-list"` after a successful submission
- Add assertion that a thrown `revalidateTag` does not cause the endpoint to return an error (wrapped in try/catch)

Target: maintain current ≥90% coverage floor on touched modules.

---

## Dependencies

No new packages. Uses existing:
- `@clerk/nextjs` — auth
- `zod` — (implicit via `zohoFetch` response parsing)
- Internal: `@/lib/zoho/books`, `@/lib/portal/types`

---

## Rollout

1. Implement behind no flag — ship directly to main once tests + build pass.
2. Manual smoke test in production: submit a quote via 5c → land on `/portal/quote/success/EST-XXXXX` → confirm the line-item summary matches the cart → click "My Quotes" → confirm the estimate appears at the top of `/portal/quotes`.
3. Monitor server logs for Zoho errors during the first week — especially `getEstimateByNumber` not-found warnings (would indicate a cache-propagation issue or a bad URL).
