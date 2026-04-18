# Louis Luso B2B Portal — Architecture Reference

**Audience:** Ken (business owner), Shawn (engineer), future support staff, future engineers
**Purpose:** Living document explaining how the partner portal works — from a buyer browsing a frame, through quote submission, Ken's Zoho actions, invoicing, payment, and shipping. Use this to understand the system, find gaps, and plan changes.
**Status:** Living document — sections are added/updated as each phase ships.
**Last major update:** 2026-04-18 (5d.2 Order Detail full design)

> This document is a strawman for review. Things will change as Ken provides feedback. Capture changes here as they're agreed, so we always have one source of truth.

---

## 1. Glossary

| Term | What it means in plain English |
|---|---|
| **Partner / Buyer** | An optical store or eyewear professional with an account on the portal who can browse, request quotes, and place orders |
| **Ken** | The business owner who reviews quotes, sets pricing, manages inventory, and runs Zoho |
| **Estimate** | The Zoho object created when a partner submits a quote. The starting point of every order |
| **Sales Order** | The Zoho object Ken creates after he approves an estimate. Commits inventory and confirms the order |
| **Invoice** | The Zoho object created from a sales order, with the bill amount and payment link |
| **Shipment / Package** | The Zoho object on a sales order that captures tracking number + carrier when Ken ships |
| **Workflow Profile** | A per-partner setting that controls the order of payment vs shipping (e.g., "cash" partners pay before shipping; "NET 30" partners receive shipment first, pay later) |
| **Pricing Plan** | A per-partner Zoho price book that determines the unit prices the partner sees (separate from workflow profile) |
| **Lifecycle** | The full chain of Zoho objects connected to one order: estimate → sales order → invoice → shipment |
| **Tier 1 / Tier 2 / Tier 3 fallback** | Three paths a partner can use to give Ken a quote, ordered most-feature-rich to most-resilient. Tier 1 is the normal portal cart; Tier 2 is a no-login form; Tier 3 is a plain mailto link |

---

## 2. Actors & Permissions

| Actor | Logged in via | Can do |
|---|---|---|
| **Public visitor** | (no login) | Browse public catalog, see SRP retail prices, submit Tier 2 quote form, contact via Tier 3 mailto |
| **Partner** | Clerk (email-only login) | Everything above, plus: see partner pricing, submit quotes through portal cart, view their own quote/order history, see invoices and tracking |
| **Ken** | Zoho Books / CRM web UI directly (he doesn't use the portal as a partner) | Approve estimates, convert to sales orders, create shipments + invoices, set partner pricing plans and workflow profiles |
| **Admin (future)** | Clerk admin role (not yet built) | Override partner metadata (pricing plan, workflow profile), see all quotes, view observability dashboards |

---

## 3. Account Types & Workflow Profiles

Partners may differ in how they pay vs receive product. The portal supports per-partner **workflow profiles** to handle this. The same five lifecycle stages exist for every account; only the order of `Invoice Sent` / `Payment Received` / `Shipped` differs.

### Standard ("cash") — pay before ship

For partners who must pay before Ken ships product. **This is the default for new accounts.**

```
Submitted → Order Received → Invoice Sent → Payment Received → Shipped
```

### NET 30 ("net30") — ship first, pay later

For partners with established credit terms. Ken ships, then sends invoice, then collects payment within 30 days.

```
Submitted → Order Received → Shipped → Invoice Sent → Payment Received
```

### Future profiles (architecture supports, not yet built)

- **NET 60** — same as NET 30 with 60-day due date copy
- **Consignment** — Ken supplies inventory to partner, partner pays as items sell. Recurring invoice cycle. Needs separate design.
- **Memo / Sample** — Partner borrows product for testing, returns or pays for kept items. No standard invoice. Needs separate design.

### Setting a partner's profile

For now, manually set in the Clerk dashboard on the partner's `publicMetadata`:
```json
{ "role": "partner", "zohoContactId": "...", "company": "...", "workflowProfile": "net30" }
```
Defaults to `"cash"` when unset. An admin UI for changing this is a future phase (5e+).

---

## 4. Standing Principles

These rules apply to **every phase** of the portal. New work that violates them needs explicit justification.

### 4.1 Zoho Integration Principles

We pay for Zoho One — leverage it fully, but respect its API limits.

1. **Cache before calling.** Every read goes through `unstable_cache` (or Cache Components) with a tag and TTL. No raw `zohoFetch` from a page or route handler unless explicitly justified.
2. **Tier TTL by volatility.** Active/in-flight data: 60s. Terminal data: 15min. Immutable reference data (collection definitions, price books): 1 hour.
3. **Parallelize within a single render.** `Promise.all` for independent fetches. Sequential only when later calls depend on earlier results.
4. **Use combined endpoints + `?include=` params** when Zoho exposes them. One round-trip beats four.
5. **Per-user route rate limit at every Zoho-touching page.** Caps how fast any one user can blow through quota even with cache misses.
6. **Webhook for invalidation when 5e ships.** Until then, accept stale-up-to-TTL.
7. **Graceful degradation on 429 / 5xx.** Render partial data + soft notice. Never hard-fail.
8. **Token refresh stays deduplicated.** Already handled in `lib/zoho/auth.ts`. Don't break it.
9. **Observability.** Log every Zoho call with `{ endpoint, ms, status, cache: hit|miss }`. Surface daily req-count vs Zoho's published limit. Alert at 80%.
10. **Never call Zoho from client-side code.** All calls server-side, behind cache.

**Published limits to respect** (verify against current Zoho docs before changing):
- Books: ~100 req/min/org
- CRM: ~200 req/min/org (edition-dependent)
- Token refresh: tighter — strict dedup required
- Daily caps exist on top of per-minute (confirm exact numbers per product when needed)

### 4.2 Optimization policy: data-driven, not preemptive

Quarterly review of Vercel Observability top-routes report → invest optimization effort in the top 5-10 routes only. Cold paths get default treatment until traffic justifies attention. We're not at AWS scale; targeted reinforcement beats premature engineering.

### 4.3 No-island rule

Every error state must include at least one **navigation action** and one **support action**. Never render an error message without a way forward. The buyer must always know how to escalate or pivot.

Every error page surfaces:
- A `[Refresh]` or `[Try again]` button when self-recovery is possible
- At least one navigation link (e.g., `[Back to My Quotes]`, `[Browse Catalog]`)
- A support escalation: `[Contact Support]` mailto:cs@louisluso.com AND/OR a link to the Tier 2 fallback form
- A reference ID (`req_a8f3k2`) the partner can quote when emailing support — let support grep logs for the exact failed request

> **Universal footer copy** (used on every error state):
> "Need help? Email cs@louisluso.com or [Submit a quote without logging in →]. Reference: `req_a8f3k2`"
> No phone number is included today — `lib/constants.ts` does not store one. If/when a customer service phone number is added to constants, extend this copy.

### 4.4 Always-on quote intake principle

The path from "buyer wants to give us money" to "Ken sees a request" must work even when every other system is down. Three tiers, each operating independently of the next:

| Tier | Path | Depends on |
|---|---|---|
| **1 (Primary)** | `/portal/quote` → POST `/api/portal/quote` → Zoho Estimate | Clerk + Zoho + Vercel |
| **2 (Fallback)** | `/quote-fallback` (no auth) → Gmail to cs@ | Vercel + Google Workspace |
| **3 (Floor)** | `mailto:cs@louisluso.com?subject=...` link in every page footer | The user's mail client only |

Tier 2 and Tier 3 must be discoverable and operational independently of Tier 1.

### 4.5 Stickiness principle

Every customer-facing process must:
- (a) Handle errors gracefully (no-island rule)
- (b) Escalate proactively before silence becomes a problem (e.g., stale-quote alerts to Ken in 5e)
- (c) Leave a return path if the customer drops off (server-side cart persistence in 5e, re-engagement nudges)

A buyer abandoned mid-funnel is potential revenue lost. Treat every drop-off as an alert worth investigating.

### 4.6 Test discipline

When a test fails, the **default response is to fix the code**, not the test. Test assertions are only updated when:
1. The behavior asserted is genuinely obsolete
2. The code change is deliberate (intended removal, rename, return-shape change)
3. The test edit ships in the same review/PR as the code change

Never modify a test purely to make it pass without first understanding *why* it failed and whether the failure represents a real regression. Equally important under AI-assisted dev: agents that silently weaken tests to make them pass break the safety net.

---

## 5. Phase Catalog

### 5a. Onboarding & Auto-Match — SHIPPED

**Summary:** New partners sign up via Clerk; system auto-matches their email to a Zoho CRM contact, hydrates `publicMetadata.zohoContactId`, and grants portal access.

**Key files:** `app/portal/sign-in/`, `lib/portal/types.ts`, Clerk webhook (auto-match logic)

**Status:** Live. Webhook fires on Clerk user creation → searches Zoho CRM for matching email → on match, sets `role: "partner"` + `zohoContactId` + `company`.

### 5b. Catalog & Pricing — SHIPPED

**Summary:** Public catalog at `/eyeglasses` shows all products with SRP retail prices. Logged-in partners see their own pricing tier (listing / SRP / bespoke) controlled by `pricingPlanId` in their metadata.

**Key files:** `lib/catalog/*`, `app/eyeglasses/`, `app/components/PartnerPrice.tsx`

**Status:** Live. 276 SSG-rendered product pages. Pricing tiers per `docs/superpowers/specs/2026-04-10-phase5b-partner-pricing-design.md`.

### 5c. Cart → Quote Submission — SHIPPED

**Summary:** Partners browse → add to cart → submit a quote at `/portal/quote`. Submit creates a Zoho Books **Estimate** + sends a Gmail confirmation to Ken + the partner. Cart state lives in localStorage with multi-tab sync.

**Key files:** `lib/portal/cart.ts`, `app/portal/quote/page.tsx`, `app/api/portal/quote/route.ts`, `lib/zoho/books.ts` (createEstimate)

**Status:** Live. Server-side pricing + per-user rate limit + Zoho Estimate creation.

### 5d.1. My Quotes (List) — SHIPPED

**Summary:** Partners see their submitted quotes/orders in a paginated list at `/portal/quotes`, with status pills (Pending Review / Confirmed / Order Placed / Declined / Expired) and totals.

**Key files:** `app/portal/quotes/page.tsx`, `app/portal/quotes/QuotesTable.tsx`

**Status:** Live. 60s cache via `unstable_cache`, 30 req/5min per-user rate limit, paginated 20/page.

### 5d.2. Order Detail — IN DESIGN (this doc + design spec)

**Summary:** Drill into a single quote at `/portal/quotes/[estimateNumber]` to see full lifecycle status via a 5-stage tracker, conditional invoice and shipping sections as the order progresses, and always-on fallback paths so a buyer can never get stuck.

**Engineer-facing spec:** `docs/superpowers/specs/2026-04-18-phase5d2-order-detail-design.md`

**Plain-English flow walkthrough:** see § 6 below — both Cash and NET-30 paths, declined/expired edge cases, fallback chain.

**Ken's Zoho SOP:** see § 7 below — the manual steps Ken takes that drive partner-visible state changes.

### 5d.3. Invoices & Pay Links — PLANNED

**Summary:** A list view of invoices (separate from estimates), Stripe pay-link processing on the portal, real branded PDF download. The "Pay Invoice" button on the order detail page hits its mature form here.

**Status:** Not started. To be designed after 5d.2 ships.

### 5d.4. Favorites — PLANNED

**Summary:** Heart icon on product cards/detail. `/portal/favorites` page. Persistent across sessions in Clerk metadata or Vercel KV.

**Status:** Not started.

### 5d.5. Reorder — PLANNED

**Summary:** One-click "Reorder" button on past orders that rebuilds the cart with the same line items. Quantities adjustable before re-submit.

**Status:** Not started. Depends on 5d.2's `getOrderLifecycle` data layer.

### 5e. Support & Stickiness — PLANNED

**Summary:** A bundle of revenue-protection capabilities. A stuck buyer is potential lost revenue; this phase systematically removes friction.

| Capability | Why |
|---|---|
| In-app support ticket form (`/portal/support`) — lightweight, ticket # + email to cs@ | Replaces ad-hoc emails, gives buyer a visible audit trail |
| Ticket history per partner | They can see what they've reported, when answered |
| Email automations: estimate accepted / invoiced / shipped / paid | Buyer doesn't have to log in to know status — passive engagement, fewer "where's my order?" tickets |
| Stale-quote alerts to Ken | If an estimate sits in `sent` >24hr, Ken gets a daily digest. Prevention vs reaction. Likely the highest-ROI item in 5e |
| Server-side cart persistence | Today cart is localStorage only; lose it = lose the order. Move to Vercel KV keyed by partner |
| Re-engagement: cart-not-submitted-in-72hr nudge | Ken would convert more carts if buyers got a friendly reminder |
| Webhook-driven cache invalidation | Zoho events call `revalidateTag(...)` per resource so partners see updates instantly instead of waiting 60s |
| Real-time chat widget (Intercom/Crisp) — optional, only if Ken or staff can monitor | High-touch, sticky, but requires human availability. Defer until Ken has bandwidth |

**Status:** Not started. To be designed after 5d.2-5d.5 ship.

### Future considerations (post-5e)

- **AI agent chatbot for FAQ deflection (24/7).** Once 5e support tickets generate a corpus of real questions, evaluate adding an in-portal AI chat agent (Vercel AI SDK + AI Gateway → Claude/GPT, RAG over `portal-architecture.md` + Ken's SOPs + recent ticket history). Goals: deflect FAQ load, give 24/7 coverage, escalate gracefully. Decision criteria: build it when ticket volume hits >5/day OR when >40% of tickets are repeat questions. Until then, premature.
- **Vercel Observability Tier 2 dashboards.** Adjacent task — turn on in Vercel UI; no code. Already paid for under Pro plan.
- **Internal `/admin/observability` Tier 3 page.** Endpoint-specific dashboards for Zoho call counts, top routes, error rates, cache hit ratios.
- **Sentry / uptime monitoring (Tier 4).** Error tracking with Slack alerts; uptime pings on critical paths.
- **Admin UI for partner metadata.** Today the workflow profile and pricing plan are set in Clerk dashboard manually. An admin role + UI is needed before this scales.

---

## 6. Phase 5d.2 Order Lifecycle — Walkthrough

### 6.1 Cash partner happy path

| Step | Partner action | What partner sees | Ken's action in Zoho | Stage on tracker |
|---|---|---|---|---|
| 1 | Submits cart at `/portal/quote` | Lands on `/portal/quotes/EST-001`. Tracker: stage 1 ✓ Submitted (Apr 18); stages 2-5 pending. Header: "Quote #EST-001 — Submitted Apr 18, 2026". | (waiting) | Submitted ●●━○━○━○━○ |
| 2 | (Refreshes within 24hrs) | Tracker still at stage 1; "Under Review" effectively shown by stage 2 being current/next. Cached 60s — refresh shows changes within 60s of Ken acting. | Opens Zoho Books, finds the estimate, reviews, clicks "Convert to Sales Order" with `reference_number = EST-001`. | Order Received ●●━●━○━○━○ (within 60s) |
| 3 | Refreshes | Stage 2 ✓ Order Received. Tracker: stages 3-5 pending. | Creates invoice from the sales order. | Invoice Sent ●━●━●━○━○ (within 60s) |
| 4 | Refreshes | Stage 3 ✓ Invoice Sent. **Invoice section appears** with INV number, amount, due date, `[Pay Invoice]` (Stripe link from Zoho) and `[Download PDF]` buttons. | (waiting on customer payment) | (no change) |
| 5 | Clicks `[Pay Invoice]` → pays via Stripe | After payment, returns to detail page. (5d.3 will polish this redirect flow.) | Stripe → Zoho webhook marks invoice as paid. | Payment Received ●━●━●━●━○ (within 60s of webhook) |
| 6 | Refreshes | Stage 4 ✓ Payment Received. Invoice section now shows `✓ Paid Apr 22, 2026` instead of the pay button. | Creates shipment on the sales order with tracking number. | Shipped ●━●━●━●━● (within 60s) |
| 7 | Refreshes | Stage 5 ✓ Shipped. **Shipping section appears** with shipped date, tracking number, carrier, `[Track Package]` button (opens carrier URL). | (delivered by carrier) | Done |

### 6.2 NET-30 partner happy path

Same as cash, but stages 3-5 reorder per the partner's `workflowProfile: "net30"`. Ken ships first, then invoices, then collects payment.

| Step | Stage on tracker |
|---|---|
| 1 | Submitted ●━○━○━○━○ |
| 2 (Ken accepts + creates SO) | Order Received ●━●━○━○━○ |
| 3 (Ken creates shipment with tracking) | Shipped ●━●━●━○━○. Shipping section appears. |
| 4 (Ken creates invoice from SO) | Invoice Sent ●━●━●━●━○. Invoice section appears with `[Pay Invoice]`. |
| 5 (partner pays within 30 days) | Payment Received ●━●━●━●━●. Done. |

### 6.3 Edge cases

**Declined estimate:**
Tracker shows stage 1 ✓ Submitted, stage 2 with red X "Declined", stages 3-5 grayed out. Page footer includes recovery affordances: contact Ken, browse catalog, submit a new quote.

**Expired estimate:**
Same as Declined but with a gray clock symbol and "Expired" label. Same recovery footer.

**Estimate not found:**
Friendly 404 page with `[View My Quotes]`, `[Browse Catalog]`, `[Contact Support]` buttons + Tier 2 fallback link. No technical details surfaced.

**Wrong customer (defensive):**
Same 404 (don't reveal that someone else's estimate exists). Logged for security review.

**Rate limit hit:**
Friendly "Too many requests, please wait a moment" page with `[Refresh]` button + `[Back to My Quotes]` link + "Limits reset every 5 minutes" copy.

**Zoho partial outage:**
Page renders the estimate with a soft notice: "Some details may be slightly delayed." Tracker shows what's known. Recovery footer always present. No hard failure or stack trace ever shown to a buyer.

### 6.4 Fallback chain in action

If a partner can't submit through the portal cart for any reason:
1. They click any `[Submit a quote without logging in →]` link → land on `/quote-fallback`
2. Fill in contact info + product list (free-form text) + optional notes → submit
3. Confirmation page: "Got it — Ken will reply within 24 hours"
4. Behind the scenes: Gmail to cs@louisluso.com + entry in `email/sent-log.jsonl`
5. Ken sees the email, manually creates an estimate in Zoho

If even the form is broken, the universal footer mailto: link opens their mail client with subject + body pre-filled. Email goes directly to cs@.

---

## 7. Ken's Zoho SOP (5d.2)

The portal tracker only advances when Ken takes specific actions in Zoho Books. This is his standard operating procedure for handling submitted quotes.

### When a partner submits a quote (from portal cart)

1. **You receive a Gmail notification** — "New quote from [Company]: EST-XXX" (existing automation from 5c)
2. **Open Zoho Books** → Estimates → find `EST-XXX` (newest first)
3. **Review:** verify products, quantities, pricing match expectations. Check inventory availability.
4. **Decide:**
   - **Accept** → click Accept button on estimate
   - **Decline** → click Decline button (write a reason in the comments — partner won't see it but you'll have a record)
   - **Let expire** → no action; estimate auto-expires per Zoho's setting
5. **If accepted, immediately convert to Sales Order:**
   - Click "Convert to Sales Order" button
   - **CRITICAL:** Verify the `Reference Number` field is set to the estimate number (e.g., `EST-001`). Zoho usually pre-fills this — confirm it before saving.
   - This commits inventory reservations.
6. **For Cash partners — invoice next:**
   - From the Sales Order, click "Convert to Invoice"
   - Confirm Stripe payment gateway is selected
   - Send invoice (Zoho emails the partner the pay link automatically)
   - Wait for payment to clear (Stripe webhook auto-marks invoice paid)
   - Create shipment with tracking number once paid
7. **For NET-30 partners — ship first, invoice after:**
   - From the Sales Order, click "New Package" / "New Shipment"
   - Enter tracking number + select carrier (UPS / FedEx / USPS / DHL)
   - Mark as shipped
   - When ready to bill, convert Sales Order → Invoice (same as step 6 above)

### Why these conventions matter

The portal partner-side tracker depends on:
- **Reference number = estimate number** so the lifecycle orchestrator can link Estimate → Sales Order → Invoice → Shipment in a single Zoho query chain
- **Tracking number on the package** so the partner sees a working `[Track Package]` button
- **Shipment created in Zoho** (not just shipped physically) so the tracker advances to stage 5

If you skip any of these, the partner sees a stalled tracker. The 5e stale-quote alert system will eventually flag this proactively, but until then this SOP is the safety net.

### Time expectations (rough — adjust based on real workload)

- Estimate review + accept/decline: within 24 business hours
- Sales order creation: immediately on acceptance
- Invoice creation: same business day for cash; within X days for NET-30 (TBD per partner agreement)
- Shipment + tracking entry: same day as physical pickup by carrier

---

## 8. Manual QA Scenarios

Numbered checklist for QA after each deploy. Add scenarios as new phases ship.

### 8.1 — 5d.2 Order Lifecycle

1. **Cash partner happy path** — submit quote → land on detail page → tracker at stage 1 → wait for Ken to accept in Zoho (≤60s cache) → refresh → tracker at stage 2 → Ken creates invoice → stage 3 + invoice section visible → click Pay → completes → stage 4 → Ken creates shipment with tracking → stage 5 + shipping section
2. **NET-30 partner happy path** — same submit → tracker at stage 2 → Ken accepts + creates SO → Ken ships first (with tracking) → tracker shows stage 3 = Shipped → Ken creates invoice → stage 4 = Invoice Sent → partner pays → stage 5 = Payment Received
3. **Declined estimate** — Ken declines in Zoho → partner refresh → tracker stops at stage 2 with red Declined badge, stages 3-5 hidden/grayed, support links present
4. **Expired estimate** — Ken lets estimate expire → partner refresh → tracker stops at stage 2 with gray clock + "Expired" label
5. **Estimate not found** — partner edits URL to fake estimate # → friendly 404 with link back to /portal/quotes
6. **Wrong-customer guard** — partner crafts URL with another customer's real estimate # → same 404 (no information leak), audit log captures attempt
7. **Rate limit** — refresh detail page 100× rapidly → "too many requests" page with refresh button
8. **Zoho partial outage** — kill SO endpoint mid-orchestration (or simulate via mock) → page renders estimate + tracker stage 1 only + soft notice + recovery links
9. **Quote fallback form** — visit `/quote-fallback` while signed out → fill form → confirm Gmail received at cs@ + entry in sent-log
10. **Mailto: fallback** — error page → click "email cs@ directly" link → mail client opens with prefilled subject+body containing error_id

---

## 9. Known Limitations & Deferred Items

| Limitation | Why deferred | Phase to address |
|---|---|---|
| Cache staleness window: partners see Ken-side updates within 60s, not instantly | Webhook invalidation requires Zoho webhook setup | 5e |
| Workflow profile set manually in Clerk dashboard (no admin UI) | Admin UI is its own workstream | Future (admin role phase) |
| Only `cash` + `net30` profiles ship at launch | Consignment + memo need separate design | Future, when first such partner exists |
| No partner-side estimate edit/cancel | Workflow assumes Ken is source of truth post-submit | Not planned |
| No partial fulfillment / multi-shipment UI | Current Zoho schema doesn't surface multi-shipment cleanly | Future, needs separate spec |
| No refund / credit memo display | Rare for B2B wholesale | Future |
| Real PDF download is via Zoho's hosted URL, not portal-served | Branded PDF served through our route is more polish than 5d.2 needs | 5d.3 |
| Stripe pay-link processing happens via Zoho's hosted page | Portal-native checkout is its own lift | 5d.3 |
| No support ticket form, no automated stale-quote alerts, no email automations on lifecycle events | All bundled in the 5e Support & Stickiness phase | 5e |
| No AI chatbot | Need ticket corpus to train against first | Post-5e |
| Tracking-number → carrier inference uses prefix heuristics | Zoho may expose carrier on the package payload directly; investigate | Optional refinement during 5d.2 implementation |

---

## 10. How to update this document

- Each new phase adds a section under § 5 (Phase Catalog) with a plain-English summary + key files + status
- Each new flow adds a walkthrough under § 6 (or a new top-level section if it's substantively different from the order lifecycle)
- Each new manual QA scenario gets numbered under § 8
- Standing principles (§ 4) are stable — change with care, with reasoning captured in the change description
- Glossary entries (§ 1) added as new terms enter the codebase
- Known limitations (§ 9) entries removed when actually addressed; new ones added when discovered
