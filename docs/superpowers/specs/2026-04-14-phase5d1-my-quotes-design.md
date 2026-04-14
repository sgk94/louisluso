# Phase 5d.1: My Quotes — Design Spec

## Overview

Partners can view a list of all quotes they have submitted, with status and total. Reads from Zoho Books Estimates. First chunk of Phase 5d (Orders/Favorites).

Closes the loop on 5c: after a partner submits a quote, they can come back and see it.

---

## Scope

**In scope:**
- `/portal/quotes` — list page showing all of a partner's submitted estimates
- Columns: Quote # · Date · Status · Total
- Status labels translated to partner-friendly copy
- Dashboard card + UserMenu item for navigation
- Empty state
- Error state

**Not in scope (later chunks):**
- Quote/order detail page (5d.2)
- Invoice list + pay links (5d.3)
- Favorites (5d.4)
- Reorder (5d.5)
- Pagination (deferred — plan documented below)
- Caching (deferred — plan documented below)

---

## Architecture

**Page:** `/portal/quotes` — Server Component, SSR, no client JS.

**Auth flow:**
1. `currentUser()` from Clerk. If null → redirect `/sign-in`.
2. `isPartner(user.publicMetadata)` — if false → redirect `/pending-approval`.
3. Read `zohoContactId` from `user.publicMetadata`. If missing → render error state "Account setup incomplete, contact support." (invariant from 5a, defensive).
4. Fetch estimates via `getEstimatesForContact(zohoContactId)`.
5. Render table (or empty state if none).

**Data flow:** Clerk session → `zohoContactId` → Zoho Books API → sorted array → server-rendered table.

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

export async function getEstimatesForContact(
  customerId: string,
): Promise<ZohoEstimateListItem[]>
```

Calls `GET /books/v3/estimates?customer_id={id}&sort_column=date&sort_order=D`. Returns newest-first. Zoho caps at 200 per response — acceptable ceiling for MVP.

**On Zoho "draft" vs "sent":**

Zoho distinguishes `draft` (created but not sent) from `sent` (estimate email has been dispatched from Zoho). These are internal Zoho lifecycle states and do not match the partner's mental model.

In our 5c flow, `POST /api/portal/quote` calls `createEstimate` without `send=true`, so **every partner-submitted quote lands in Zoho as `draft`**. It only transitions to `sent` when Ken (or a Zoho workflow) sends the estimate email. From the partner's perspective, both states mean the same thing: *"I submitted this, Ken hasn't confirmed stock yet."*

**Decision:** treat `draft` and `sent` as the same partner-facing state. Both map to the label **"Pending Review"**. No filter — both are returned in the list.

Ken's own WIP drafts (created manually in Zoho before a partner exists, or for a different customer) are scoped out naturally by the `customer_id` query param. If Ken drafts a hypothetical quote directly under a partner's contact, the partner will see it — that is the expected, acceptable behavior, since Ken is not expected to create speculative drafts under partner contacts.

**Response validation:** parses the Zoho response through a Zod schema at runtime (the `estimates` array + each item's required fields). On parse failure, throws an error that the page layer maps to the generic error state. This adds minor runtime cost but prevents malformed data from reaching the UI; matches the safety bar appropriate for partner-facing server code.

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

### Empty State

```
You haven't submitted any quotes yet.
[Browse Collections] → /eyeglasses
```

### Error State

```
Unable to load quotes right now. Please try again in a moment.
```

Logged server-side via `console.error` with context. No Zoho error detail leaked to the UI.

### Responsive

Mobile (≤640px) collapses to stacked 2-column cards:
- Top row: Quote # · Total
- Bottom row: Date · Status

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
| Zoho API error (any 4xx/5xx) | Render error: "Unable to load quotes right now. Please try again in a moment." |
| Zoho returns malformed data | Zod parse failure inside `getEstimatesForContact`; page treats it as an API error |

All server-side errors logged with `console.error`, including the `zohoContactId` and a short error message. No Zoho response body leaked to the client.

---

## Deferred: Rate Limit / Cache Plan

**Current behavior:** every `/portal/quotes` page view → 1 Zoho Books API call. Zoho paid plan limits: ~25,000/day, ~100/min per org.

**Trigger to revisit:**
- Sustained Zoho 429s in server logs
- A partner reports stale data
- Daily Zoho call count climbing past ~60% of limit

**Option A (simple cache, recommended first step):**
Wrap `getEstimatesForContact` in Next.js `unstable_cache` keyed by `customerId`, TTL 60s. Partner sees fresh data within a minute. On quote submission (5c), call `revalidateTag(\`quotes-${customerId}\`)` to invalidate immediately. One-line change, invisible to partner.

**Option B (per-partner rate limit):**
Add Upstash rate limit on `/portal/quotes`, 30 requests per 5 min per user. Cheapest if abuse is individual, not global.

**Option C (background sync):**
Nightly cron pulls all partner estimates into our own store (Postgres/KV). Page reads from there. Overkill unless we exceed 100+ active partners.

Start with Option A when triggered.

---

## Deferred: Pagination Plan

**Current behavior:** show all, newest first. Zoho caps at 200 per response — any estimates past the first 200 are silently dropped.

**Trigger to revisit:**
- Any partner's estimate count crosses 100
- Page load time exceeds 1s

**Implementation when needed:**
1. Add `page` + `per_page` params to `getEstimatesForContact`
2. Read `page_context.total` + `page_context.has_more_page` from Zoho response
3. Add Prev/Next buttons bound to `searchParams.page`
4. Default 20/page

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/portal/quotes/page.tsx` | Server component — auth + fetch + render |
| `app/portal/quotes/QuotesTable.tsx` | Presentational table (no client JS) |
| `__tests__/app/portal/quotes.test.tsx` | Page rendering: rows, empty, error |
| `__tests__/lib/zoho/books-estimates-list.test.ts` | `getEstimatesForContact` + status mapper |

### Modified Files

| File | Change |
|------|--------|
| `lib/zoho/books.ts` | Add `getEstimatesForContact` + `partnerLabelForEstimateStatus` + `ZohoEstimateListItem` interface |
| `app/portal/page.tsx` | Enable "My Quotes" card, rename from "View Orders", update description + href |
| `app/components/UserMenu.tsx` | Add "My Quotes" dropdown item above Account Settings |

No new dependencies.

---

## Testing

### Unit Tests

**`__tests__/lib/zoho/books-estimates-list.test.ts`:**
- `getEstimatesForContact` calls `zohoFetch` with the correct URL + params (`customer_id`, `sort_column=date`, `sort_order=D`)
- Returns the `estimates` array from the response (including `draft` rows — no filter)
- Throws when Zoho returns malformed data (Zod parse failure)
- Propagates Zoho errors (doesn't swallow)
- `partnerLabelForEstimateStatus` maps each of the 6 known statuses correctly
- `partnerLabelForEstimateStatus` returns "Pending Review" for both `draft` and `sent`
- `partnerLabelForEstimateStatus` returns title-cased fallback for unknown status

### Component Tests

**`__tests__/app/portal/quotes.test.tsx`:**
- Renders table with sample estimate rows (3 different statuses); each row shows Quote #, formatted date, partner status label, formatted total
- Renders empty state with "Browse Collections" link when list is empty
- Renders generic error state when `getEstimatesForContact` throws
- Status pill element carries the expected class per status (e.g., "Confirmed" row has `text-bronze`)
- Non-partner user → redirects to `/pending-approval` (mock Clerk)
- Unauthenticated user → redirects to `/sign-in`
- Partner missing `zohoContactId` → renders account setup error (distinct copy from generic Zoho error)

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
2. Partner accounts in production: Ken's test account + any onboarded partners can verify by submitting a quote via 5c → refreshing `/portal/quotes`.
3. Monitor server logs for Zoho errors during first week.
