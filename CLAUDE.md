# louisluso.com — Website Summary

## About
E-commerce eyewear retailer (B2B wholesale to optical stores + B2C catalog). Domain registered through Bluehost, hosted on AWS (being migrated to Vercel).

## New Website (in progress — Phase 5c complete)
Replacing WordPress/WooCommerce with a custom Next.js site. See `docs/superpowers/specs/2026-04-08-louisluso-website-redesign.md` for full spec.

### Stack
- **Framework:** Next.js 16 (App Router, TypeScript strict)
- **Hosting:** Vercel Pro — https://louisluso-flax.vercel.app
- **Auth:** Clerk (email-only login, B2B partner role)
- **Backend:** Zoho One (Inventory, Books, CRM) via REST APIs
- **Payments:** Stripe (via Zoho Books invoice payment links)
- **Images:** Cloudinary (CDN + auto-optimization)
- **Maps:** Mapbox (dealer locator)
- **Rate Limiting:** Upstash Redis
- **Icons:** Heroicons
- **Newsletter:** Zoho Campaigns
- **Email:** Gmail API (cs@louisluso.com)
- **Fonts:** Cormorant Garamond (headings) + DM Sans (body) via next/font
- **Testing:** Vitest, React Testing Library (287 tests)
- **Package Manager:** pnpm

### Project Structure (new site files)
- `app/` — Next.js App Router pages and API routes
- `lib/env.ts` — Zod-validated environment variables (lazy Proxy)
- `lib/zoho/auth.ts` — Zoho OAuth2 token management with deduplication
- `lib/zoho/client.ts` — Base HTTP client (auto-detects product, sets correct org header)
- `lib/zoho/inventory.ts` — Zoho Inventory API (items, groups, price books)
- `lib/zoho/books.ts` — Zoho Books API (sales orders, invoices)
- `lib/zoho/crm.ts` — Zoho CRM API (leads with Region/Country, contacts, searchLeads, file attachments)
- `lib/crm/regions.ts` — Regional CRM: 5 metro regions (zip prefix matching), location knowledge base CRUD
- `lib/catalog/collections.ts` — Static collection config (21 collections, SKU prefix/brand matching)
- `lib/catalog/catalog.ts` — Catalog data layer (Zoho items + SRP26 pricing merge, React.cache wrapped)
- `lib/catalog/sku-parser.ts` — Parse color names and dimensions from Zoho SKU text
- `lib/catalog/types.ts` — Shared catalog types (CatalogProduct, CatalogVariant, etc.)
- `lib/catalog/images.ts` — Product image URL helper (Cloudinary URLs)
- `lib/catalog/format.ts` — Price formatting (Intl.NumberFormat)
- `lib/fonts.ts` — Font configuration (Cormorant Garamond + DM Sans)
- `lib/gmail.ts` — Gmail API send utility with BCC support
- `lib/schemas/contact.ts` — Contact form Zod validation schema
- `lib/schemas/partner.ts` — Partner application Zod validation schema
- `lib/schemas/contact-dealer.ts` — Contact dealer form Zod schema
- `lib/constants.ts` — Shared business info (address, email, social links)
- `lib/rate-limit.ts` — Upstash rate limiter (general + dealer-contact specific)
- `lib/dealers/types.ts` — Dealer type definitions
- `lib/dealers/mock-data.ts` — 10 mock dealers (Chicago area, to be replaced with Zoho CRM)
- `lib/dealers/distance.ts` — Haversine distance calculation + sort/filter by radius
- `lib/portal/types.ts` — PartnerMetadata Zod schema + `isPartner()` type guard
- `lib/portal/cart.ts` — Cart state (localStorage + multi-tab sync, React context via `CartProvider`)
- `lib/schemas/quote.ts` — Quote submission Zod schema
- `app/components/PartnerPrice.tsx` — Price display (SRP / listing / strikethrough+pill for bespoke)
- `app/components/UserMenu.tsx` — Partner dropdown menu in nav
- `app/components/CartProvider.tsx` — Cart context provider (partners only)
- `app/components/CartIcon.tsx` — Shopping bag with bronze count badge in nav
- `app/components/VariantQuoteTable.tsx` — Per-variant quantity table on product detail (partners)
- `app/portal/quote/page.tsx` — Quote review/edit + submit to Zoho Books Estimate
- `proxy.ts` — Clerk middleware (protects /portal routes)
- `__tests__/` — Vitest test files
- `.env.local` — Local environment variables (gitignored)
- `.env.local.example` — Template for env vars

### Pricing Model
Three-tier pricing from Zoho Inventory:
- **Listing price** (`item.rate`) — wholesale base price on each Zoho item. Default for B2B partners.
- **SRP** ("SRP26" Price Book) — suggested retail price. Shown on public site.
- **Bespoke** (Ken-assigned Price Book per partner) — custom rates via `pricingPlanId` in Clerk metadata. Overrides listing price for that partner.

### Phases
1. **Foundation** — COMPLETE (scaffold, Zoho APIs, Clerk auth, rate limiting, Vercel deploy)
2. **Public Catalog** — COMPLETE (collection pages, product grids, product detail, SRP26 pricing, Cloudinary images, 276 SSG pages)
3. **Static Pages** — COMPLETE (design system, nav/footer, homepage, about, why, contact form, partner application, privacy/terms)
4. **Dealer Locator** — COMPLETE (frontend: dark Mapbox map, dealer sidebar, contact modal, mock data; backend Zoho CRM integration deferred)
5. **B2B Portal**
   - **5a Portal Foundation** — COMPLETE (auto-matching via Zoho CRM, dashboard, account page, UserMenu, invite script)
   - **5b Partner Pricing** — COMPLETE (listing price in catalog, PartnerPrice component, pricing API, "Find a Dealer" hidden for partners)
   - **5c Cart/Quote** — COMPLETE (cart state w/ localStorage + multi-tab sync, VariantQuoteTable, /portal/quote page, POST /api/portal/quote → Zoho Books Estimate + Gmail confirmation, server-side pricing, rate limits)
   - **5d Orders/Favorites** — next (order history, invoices, favorites, reorder)
6. **Polish & Launch** — GA4, image migration, DNS cutover, WordPress retirement

## Current Platform (WordPress — being replaced)
- CMS: WordPress
- E-commerce: WooCommerce
- Page Builder: Elementor
- Theme: Savoy (premium theme)
- Caching: LiteSpeed Cache
- Key Libraries: jQuery, Slick carousel, Flickity, PhotoSwipe
- Integrations: HubSpot (forms/CRM), Google Analytics, reCAPTCHA v2

## Active Plugins (confirmed from frontend)
- WooCommerce (core shop)
- LiteSpeed Cache (caching)
- BeRocket Better Labels (product labeling/badges)
- WPForms / HubSpot Forms
- Contact Form 7
- WP Google Maps
- WC Bookings (appointment system)
- Google Analytics
- Wordfence (firewall/security)

## Hosting & Infrastructure
- Registrar: Bluehost Inc.
- Actual Hosting: Amazon Web Services (AWS Lightsail)
- DNS Management: AWS Route 53
- Server IP: 3.21.67.85 (AWS US-East-2 region)
- Domain Age: Registered September 20, 2012 (~13 years old)
- Domain Expiry: September 20, 2026
- Domain Privacy: Enabled via Perfect Privacy, LLC

## Product Structure
- Products are variable (color variants per frame)
- All prices display as $0.00 on frontend (likely intentional — prescription eyewear, pricing handled elsewhere)
- Shop page uses "Show more" links instead of "Add to Cart" (products require variant selection)
- Product categories include: Signature Plus Series, and others
- ~13 pages of products in the shop
- Product naming: alphanumeric codes (e.g., SP1018, T-7241, AB003, ML7004, BRICK)

## Stock Updates (2026-03-04 to 2026-03-05) — COMPLETED

Bulk stock status corrections across 4 collections via WooCommerce REST API. Source: owner's handwritten OOS list (3/3/2026). Full variant-level detail in `docs/stock-update-guide-2026-03-04.md`.

### What was done
1. **Set OOS variants** — 16 variants → `outofstock` (qty=0) per owner's list (`scripts/update-stock.ts`)
2. **Restored in-stock variants** — 69 variants had drifted to `outofstock` incorrectly; restored across Junior Series, Classic, London Collection, Signature Series (`scripts/ensure-instock.ts`, `scripts/ensure-sg-instock.ts`)
3. **Fixed parent manage_stock** — 35 parent products needed `manage_stock: true` + `stock_quantity: 20` for "In Stock" labels to display on frontend (`scripts/enable-sg-manage-stock.ts`)

### Key learnings
- WooCommerce needs `manage_stock: true` + stock qty on **parent** product for stock labels to render, even when variants have correct status
- Wordfence rate-limits rapid API calls → IP whitelisted
- Some variants on owner's OOS list didn't exist in WooCommerce (4 confirmed non-existent)
- LC9022: all variants were already OOS before our work (predates our updates, not on owner's list)
- 288 total products in store still lack `manage_stock` — only target collections were updated
- Signature Series slug is `signature-series` (not "Signature Plus Series")
- SG SKUs sometimes omit "C" prefix (e.g., `SG1031-4` for C4)

## Marketing Strategy

### Strategy 1: Vision Source / Frame Dream Channel Entry

**Goal:** Become an approved vendor in Vision Source's Frame Dream program to access 4,500+ optometry practices nationwide.

**Key Points:**
- Frame Dream is Vision Source's centralized frame supply chain program (1,000+ member practices)
- Approved vendors get listed in the program catalog → nationwide distribution
- Program dominated by EssilorLuxottica-affiliated vendors; strict pricing/operational requirements
- Pricing expectation: 30-50% wholesale discount (e.g., $250 retail → $45-70 vendor price)
- Must support 48-hour shipment capability and large inventory levels
- Participation fees and vendor rebate commitments may apply

**Action Items:**
1. Supply frames to 20-30 Vision Source member practices directly (build relationships first)
2. Collect best-selling frame data and reorder metrics from those accounts
3. Attend Vision Source regional meetings and trade events (Vision Expo)
4. Contact Frame Dream sourcing team — pitch niche value (Asian design, titanium, value-priced)
5. Prepare vendor application with brand identity, design quality, price point, and margin structure documentation
6. Build 48-hour shipment capability and inventory capacity before applying

### Strategy 2: Multi-Channel Distribution to $10M Revenue

**Goal:** Reach $10M annual revenue through diversified optical distribution channels.

**Key Points:**
- 5 distribution channels: independent optical stores, buying groups, optical distributors, regional chains, e-commerce/DTC
- Major U.S. distributors: ABB Optical Group, Europa Eyewear, ClearVision Optical, Modern Optical International, FGX International, Marchon Eyewear, Safilo Group, VSP Vision/Eyefinity
- Buying groups (Vision Source, PERC Alliance) offer higher per-store revenue than independent accounts

**Revenue Target Breakdown:**
| Channel | Stores | $/Store/Year | Revenue |
|---|---|---|---|
| Independent Optical | 500 | $5,000 | $2.5M |
| Buying Groups | 400 | $7,500 | $3.0M |
| Distributor Channels | 300 | $8,000 | $2.4M |
| Online / Other | - | - | $2.1M |
| **Total** | | | **$10M** |

**Action Items:**
1. Submit vendor applications to major distributors (ABB, Europa, ClearVision, Modern Optical)
2. Arrange meetings with frame buyers / category managers at each distributor
3. Network at Vision Expo and other optical trade shows
4. Build a regional sales representative network for independent optical store coverage
5. Develop e-commerce/DTC channel for online revenue stream ($2.1M target)
6. Join PERC Alliance and other buying groups beyond Vision Source
7. Track per-channel revenue against targets quarterly

## Restock (2026-03-09) — COMPLETED

Restocked 19 variants across 5 products (300 total units) via WooCommerce REST API. Source: owner's printed restock list dated 26.03.09. Script: `scripts/restock-2026-03-09.ts`.

| Model | Variants | Qty each |
|-------|----------|----------|
| SG1011 | C2 (20), C6 (10), C24 (20) | 50 total |
| SG1012 | C2, C3, C4, C8, C24 | 10 each (50 total) |
| SG1013 | C1, C2, C3, C4, C8 | 20 each (100 total) |
| SG1015 | C2, C3, C4, C8 | 20 each (80 total) |
| LC9018 | C1, C24 | 10 each (20 total) |

### Key finding
- Product id 8364 is named "SG1013" in WooCommerce but contains SG1012 SKUs — SKU-based model matching is more reliable than product name matching

## API Access
- WooCommerce REST API keys: configured in `.env` (Read/Write)
- API working as of 2026-03-04. IP whitelisted in Wordfence to avoid rate-limit blocks.
- Security: Wordfence firewall active — rapid API calls trigger temporary 403 bans (default 5 min, but can persist longer)
- No local WordPress files in this repo

## Email Automation System

### Architecture
- **Transport:** Gmail API (primary) or SMTP (fallback), controlled by `EMAIL_TRANSPORT` env var
- **Gmail API:** OAuth2 "installed app" flow → `credentials.json` + `token.json`
- **Threading:** Follow-up emails appear in same Gmail conversation via `threadId` + `In-Reply-To` headers
- **Reply detection:** Gmail API checks threads for external replies → auto-marks contacts as "replied"
- **Templates:** HTML + optional plain text in `email/templates/`, rendered with `{{var}}` substitution
- **Sequences:** Multi-step drip campaigns with configurable delays, skip conditions, and rate limiting
- **Sent log:** Every sent email is logged to `email/sent-log.jsonl` with full rendered body text + metadata

### Sent Log (`email/sent-log.jsonl`)
JSONL append log for outreach performance analysis. Three event types:
- `"sent"` — logged at send time with: to, name, company, sequence, step, template, subject, subjectVariant, rendered body text, messageId, threadId, transport, segment
- `"outcome"` — logged when reply detected or sequence completes with: to, sequence, step, outcome, daysToReply, tag, sentiment, notes
- `"stage"` — logged for conversion funnel tracking with: to, sequence, stage (replied/sample-requested/meeting-booked/order/reorder), notes

### Feedback Levers
- **Quick tag** — Tag replies with labels: `pnpm email:sequence -- tag --email X --tag warm [--sentiment positive] [--notes "..."]`
- **Conversion stages** — Track funnel: `pnpm email:sequence -- stage --email X --stage sample-requested [--notes "..."]`
- **Subject A/B** — Sequence steps support `subjectVariants` array; randomly picks variant at send, logs which was used
- **Send time analysis** — `getPerformanceBySendTime()` correlates reply rates with day/hour
- **Segment analysis** — Contact tags flow through as `segment` in sent log; `getPerformanceBySegment()` compares reply rates across segments
- **Link tracking** — UTM params auto-injected on template links (`utm_source=email&utm_medium=sequence&utm_campaign=NAME&utm_content=stepN`), trackable in Google Analytics
- **Performance report** — `pnpm email:sequence -- report [--sequence NAME]` prints all analytics

**Purpose:** Cross-reference email language/hooks that generate replies vs those that don't. Use analysis functions from `sent-log.ts` to compare `repliedBodies` vs `ignoredBodies`, subject variants, send times, and segments.

**When writing new email templates:** Read the sent log to identify patterns in language, subject lines, and hooks that correlate with higher reply rates. Favor approaches from `repliedBodies`; avoid patterns from `ignoredBodies`. Check subject A/B results and segment data to tailor messaging.

### Email Scripts
- `email/cli-send.ts` — Send single email. `pnpm email:send -- --to EMAIL --template NAME --subject "Subject" [--var key=value] [--dry-run]`
- `email/cli-import.ts` — Import contacts from CSV. `pnpm email:import -- --file contacts.csv`
- `email/cli-enroll.ts` — Enroll contacts into sequences. `pnpm email:enroll -- --sequence NAME (--tag TAG | --email EMAIL --name NAME --company COMPANY)`
- `email/cli-sequence.ts` — Run sequences / status / tag replies / log stages / report. `pnpm email:sequence -- run|status|reply|tag|stage|report --sequence NAME [--dry-run]`
- `email/cli-auth.ts` — One-time Gmail OAuth2 setup. `pnpm email:auth`
- `email/campaigns/new-collection-blast.ts` — One-off marketing blast. `pnpm email:blast`

### Email Core Modules
- `email/env.ts` — Zod-validated env vars with conditional SMTP/Gmail validation
- `email/send.ts` — Transport dispatch (smtp vs gmail), auto-logs to sent-log.jsonl on success
- `email/gmail.ts` — Gmail API client: OAuth2 auth, send, reply detection, connection verify, Google Drive access
- `email/sequences.ts` — Sequence runner: enrollment, state machine, delay logic, reply detection, outcome logging
- `email/templates.ts` — Template loading and rendering
- `email/contacts.ts` — Contact directory (import, lookup, tag-based filtering)
- `email/batch.ts` — Batch send utilities
- `email/sent-log.ts` — JSONL sent log: append sent/outcome/stage events, performance analysis (by step, subject, time, segment, funnel)

### Email State Files (all gitignored)
- `email/state.json` — Sequence progress per contact (step, status, threadId, firstMessageId)
- `email/contacts.json` — Contact directory (emails, names, companies, tags)
- `email/sent-log.jsonl` — Append-only log of every sent email + outcomes
- `email/credentials.json` — Google OAuth2 client credentials
- `email/token.json` — Google OAuth2 refresh/access tokens

## Scripts & Files

### Stock Scripts (`scripts/`)
- `scripts/update-stock.ts` — Set variants to `outofstock` (qty=0). Dynamic lookup by product name + color. `pnpm update-stock`
- `scripts/update-sg-stock.ts` — Set Signature Series variants to `outofstock`. `npx tsx scripts/update-sg-stock.ts`
- `scripts/ensure-instock.ts` — Restore non-OOS variants to `instock` (Junior, Classic, London). `npx tsx scripts/ensure-instock.ts [--dry-run]`
- `scripts/ensure-sg-instock.ts` — Same for Signature Series (`signature-series` slug). `npx tsx scripts/ensure-sg-instock.ts`
- `scripts/enable-sg-manage-stock.ts` — Enable `manage_stock` on SG parent products. `npx tsx scripts/enable-sg-manage-stock.ts [--dry-run]`
- `scripts/check-manage-stock.ts` — Check `manage_stock` status on products (diagnostic/audit). `npx tsx scripts/check-manage-stock.ts`
- `scripts/list-remaining-variants.ts` — List remaining variants for a product (audit/debugging). `npx tsx scripts/list-remaining-variants.ts`
- `scripts/restock-2026-03-09.ts` — Restock 19 variants with specific quantities (SG1011/12/13/15, LC9018). `npx tsx scripts/restock-2026-03-09.ts [--dry-run]`

### CRM Scripts (`scripts/`)
- `scripts/append-contact.ts` — Business card → Zoho CRM lead + Google Sheet + location knowledge base. Auto-detects country (US/CA), auto-assigns region from zip prefix. Single: `npx tsx scripts/append-contact.ts '<JSON>'` | Batch: `npx tsx scripts/append-contact.ts --batch <file.json> [--resume]` (2s delay, checkpoint file, atomic KB writes, split CRM/Sheet error handling)
- `scripts/crm-pull.ts` — Pull CRM leads by region/state/city into `email/contacts.json` for email sequences. `pnpm crm:pull -- --region socal`
- `scripts/crm-pull-lib.ts` — Testable logic for CRM pull (buildCriteria, leadsToContacts)

### Regional CRM System
- **Source of truth:** Zoho CRM (leads with Region custom field)
- **Regions:** Metro-area level (socal, norcal, dallas, austin, houston, lasvegas) — add-as-you-go in `lib/crm/regions.ts`
- **Knowledge base:** `data/location-kb.json` (gitignored) — auto-grows as cards are scanned, maps city+state→zip+region. Atomic writes (temp+rename), skip-if-exists (preserves first-seen zip)
- **Country detection:** Auto-detects US vs Canada from state/province abbreviation or zip/postal code format
- **Google Drive:** OAuth2 scope enabled — can read/download/move files in Drive folders
- **Workflow:** Scan card → CRM lead + Sheet + KB → later pull by region → enroll in email sequence
- **Gotchas:** Zoho rate-limits token refresh after ~10 rapid calls (use batch mode). Sheet uses `RAW` valueInputOption to prevent formula injection. CRM and Sheet writes have separate error handling (Sheet failure won't mask CRM success). `searchLeads` paginates automatically. `buildCriteria` validates/sanitizes inputs against injection.

### Reference Files
- `docs/stock-update-guide-2026-03-04.md` — Full audit: variant IDs, color codes, flags
- `docs/q-vision-business-plan-summary.md` — English business plan summary
- `docs/q-vision-investment-plan-summary.md` — Korean investor plan (translated/summarized)
- `docs/Marketing Strategy.pdf` / `docs/Marketing Strategy 2.pdf` — Vision Source & multi-channel distribution strategy docs
- `assets/OUT OF STOCK LIST AS OF 3-3-2026.jpg` — Owner's handwritten OOS list
- `assets/SG OUT OF STOCK LIST.jpeg` — Owner's Signature Series OOS list
- `assets/TalkMedia_i_d65b2efb56db.jpeg` — Restock list image (2026-03-09)
- `.env` / `.env.example` — WooCommerce API creds + email config (gitignored)
