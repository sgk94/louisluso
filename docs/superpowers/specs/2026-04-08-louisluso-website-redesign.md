# louisluso.com Website Redesign — Design Spec

## Overview

Replace the current WordPress/WooCommerce site with a custom-built Next.js application. The new site serves two audiences: public visitors browsing the eyewear catalog (B2C showroom) and authenticated optical store partners placing wholesale orders (B2B portal). Zoho One provides the entire backend — Inventory, Books, and CRM — with the website acting as a frontend that reads from and writes to Zoho's APIs.

## Goals

- Replace WordPress/WooCommerce entirely — retire the AWS Lightsail instance
- Build a public product catalog showing SRP pricing
- Build a B2B wholesale portal with per-account bespoke pricing and quote/order flow
- Integrate Zoho Inventory (products), Zoho Books (invoicing/payments), and Zoho CRM (dealers/partners)
- Add a dealer locator with "Contact This Dealer" functionality
- Add a "Become a Partner" application flow

## Non-Goals

- B2C e-commerce (no public checkout — customers cannot buy online)
- SEO optimization beyond basics (traffic comes from in-person sales relationships, not search)
- Email outreach migration (current CLI system stays as-is for now; may move to Zoho CRM Cadences later)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript, strict mode) |
| Hosting | Vercel (Pro plan) |
| Auth | Clerk (free tier) |
| Backend/Data | Zoho One (Inventory + Books + CRM) |
| Payments | Stripe (via Zoho Books invoice payment links) |
| Icons | Heroicons |
| Images | Cloudinary (CDN + auto-optimization) |
| Maps | Mapbox (dealer locator) |
| Newsletter | Zoho Campaigns (included in Zoho One, syncs with CRM) |
| Styling | TBD (user will provide design direction with reference sites) |
| Package Manager | pnpm |
| Testing | Vitest, React Testing Library, Playwright |

## Monthly Cost

| Service | Cost |
|---|---|
| Zoho One (2 users, annual billing) | ~$70/mo |
| Vercel Pro | $20/mo |
| Clerk | $0 (free tier — 10K MAUs) |
| Stripe | 2.9% + $0.30/txn (~$40-60/mo at current volume) |
| Cloudinary | $0 (free tier — 25K transformations/mo) |
| Mapbox | $0 (free tier — 50K map loads/mo) |
| Domain/DNS (Route 53) | ~$3/mo |
| **Total** | **~$93/mo + Stripe fees** |

---

## Architecture

```
┌─────────────┐  ┌──────────────────┐  ┌─────────────┐
│   Public     │  │  B2B Store       │  │  Ken (Admin) │
│   Visitor    │  │  (logged in)     │  │              │
└──────┬───────┘  └────────┬─────────┘  └──────┬───────┘
       │                   │                    │
       └───────────┬───────┘                    │
                   ▼                            │
       ┌───────────────────────┐                │
       │   Next.js on Vercel   │                │
       │  ┌─────────────────┐  │                │
       │  │ React Frontend  │  │                │
       │  │ (SSR / ISR)     │  │                │
       │  └─────────────────┘  │                │
       │  ┌─────────────────┐  │                │
       │  │ API Routes      │  │                │
       │  │ (Serverless)    │  │                │
       │  └─────────────────┘  │                │
       │  ┌─────────────────┐  │                │
       │  │ Clerk Middleware │  │                │
       │  └─────────────────┘  │                │
       └───────────┬───────────┘                │
                   │                            │
       ┌───────────┼───────────┐                │
       ▼           ▼           ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│  Zoho    │ │  Zoho    │ │  Zoho    │  │  Zoho    │
│Inventory │ │  Books   │ │   CRM   │  │ Dashboard│
│          │ │          │ │          │  │  (Admin) │
└──────────┘ └──────────┘ └──────────┘  └──────────┘
```

### Key Principles

- **Zoho is the source of truth** for all data — products, inventory, contacts, invoices
- **Next.js API routes** proxy all Zoho API calls — credentials never exposed to the browser
- **ISR caching** for product data — revalidate every ~15 minutes to stay within API rate limits
- **Webhooks** where available — Zoho pushes changes to the site instead of polling
- **Clerk** manages auth — Zoho CRM contact ID stored in Clerk user metadata for lookups

### API Rate Limits (Zoho One)

| Product | Daily | Per-Minute |
|---|---|---|
| Zoho Inventory | ~2,500/day | 100/min |
| Zoho Books | 2,500–5,000/day | 100/min |
| Zoho CRM (Enterprise) | 5,000+ credits/day | 100/min/user |

Mitigation: ISR caching, webhooks, and in-memory/Redis caching for frequently accessed data (dealer list, price lists, product catalog).

---

## Sitemap

### Public Pages (no auth)

| Route | Page | Description |
|---|---|---|
| `/` | Homepage | Hero banners, collection showcases, brand intro, CTA to browse or become a partner |
| `/eyeglasses` | Eyeglasses | Category page — grid of eyeglasses collections |
| `/eyeglasses/[collection]` | Collection | Product grid for a specific collection, filters by color, SRP pricing |
| `/sunglasses` | Sunglasses | Category page — grid of sunglasses collections |
| `/sunglasses/[collection]` | Collection | Product grid for a specific collection |
| `/accessories` | Accessories | Accessories listing |
| `/products/[slug]` | Product Detail | Images, color variants, SRP price, specs, "Find Nearest Dealer" button. Logged-in B2B users see bespoke pricing + "Add to Quote" |
| `/why-louisluso` | Why LOUISLUSO? | ULTEM material info, FDA/ECO compliance, brand differentiation |
| `/about` | About Us | Mission, vision, values, company story |
| `/find-a-dealer` | Dealer Locator | Map with address/radius search, dealer pins, "Contact This Dealer" email flow |
| `/become-a-partner` | Partnership Application | Form → creates Lead in Zoho CRM |
| `/contact` | Contact Us | Contact form + Google Maps (Q-Vision Optics, Arlington Heights, IL) |
| `/appointment` | Book Appointment | **TABLED** — existed on current site (Webba Booking) but was not linked in nav. May add later if needed. |
| `/privacy` | Privacy Policy | Privacy policy |
| `/terms` | Terms of Service | Terms of service |

### B2B Portal (Clerk auth required)

| Route | Page | Description |
|---|---|---|
| `/portal` | Dashboard | Welcome, recent orders, account summary, quick actions |
| `/portal/catalog` | Wholesale Catalog | Same products with bespoke wholesale pricing per account |
| `/portal/quote` | Cart / Quote Builder | Review items, quantities, pricing. Submit → creates Sales Order in Zoho Books |
| `/portal/orders` | Order History | Past orders, invoice status, payment status. Reorder from past orders |
| `/portal/favorites` | Favorites | Saved favorite products for quick reordering |
| `/portal/account` | Account Settings | Company info, shipping address, contact details, newsletter subscription preference |

### Navigation Structure

**Top bar:** "The World's Lightest Frames" tagline + social links (Facebook, Instagram)

**Main nav:** Eyeglasses (mega-menu with collections) | Sunglasses | Accessories | Find a Dealer

**Utility nav (right):** Favorites (heart icon) | Login/Account | Cart (with count badge)

**Footer:** Why LOUISLUSO | About Us | Become a Partner | Contact Us | Find a Dealer | Privacy | Terms

---

## Data Sources

### Products & Inventory → Zoho Inventory API

- **Item Groups** = parent products with color variants (maps to current WooCommerce variable products)
- Each variant has: SKU, stock level, price, images (up to 10 per item, 5MB each)
- ~288 products across 20+ collections
- Collections managed via item group categorization or custom fields (Zoho Inventory has limited category API — collections may need a mapping layer)
- ISR cached, revalidated every ~15 minutes

### Pricing → Zoho Inventory Price Lists API

**Public (B2C):** SRP pricing displayed to all visitors. Sourced from the price list or a markup on list price.

**B2B:** Two standard discount tiers + bespoke overrides:

| Tier | Discount | Condition |
|---|---|---|
| Standard | 20% off list price | No minimum order |
| Volume | 30% off list price | 25+ pieces |
| Bespoke | Custom per account | Set by Ken in Zoho |

Zoho Inventory Price Lists support per-contact assignment — each B2B store gets assigned their pricing tier. The website reads the store's price list via API when they're logged in.

**2026 Price List (reference):**

| Collection | List | SRP | 20% | 30% |
|---|---|---|---|---|
| Eye Cloud | $57 | $170 | $45.60 | $39.90 |
| Classic | $65 | $195 | $52.00 | $45.50 |
| Junior | $71 | $214 | $56.80 | $49.70 |
| Signature | $76 | $227 | $60.80 | $53.20 |
| Signature+ | $81 | $243 | $64.80 | $56.70 |
| London | $81 | $243 | $64.80 | $56.70 |
| London Titanium | $97 | $290 | $77.60 | $67.90 |
| Milan | $99 | $296 | $79.20 | $69.30 |
| Veritas | $51 | $154 | $42.40 | $37.10 |
| LL Titanium (L-800) | $89 | $267 | $71.20 | $62.30 |
| LL Titanium (L-5000) | $108 | $324 | $86.40 | $75.60 |
| Tandy | $84 | $253 | $67.20 | $58.80 |
| Tandy Titanium | $108–121 | $324–362 | $86–97 | $75–85 |
| Urban | $121 | $362 | $96.80 | $84.70 |
| Grand Collection | $73 | $218 | $58.40 | $51.10 |
| SNF | $130 | $390 | $104.00 | $91.00 |
| Rimless Air | $68 | $203 | $54.40 | $47.60 |
| Skylite | $12–15 | $36–42 | No discount, no warranty |
| 2026 Signature (SG4041–4048) | $68 | $180 | $54 | $47.60 |
| 2026 London Titanium (LC9050–9055) | $99 | $280 | $79 | $69.30 |
| 2026 Urban Titanium (LU3001–3005) | $102 | $300 | $82 | $71.40 |

**Discontinued (excluded from new site):** CLROTTE, Dr. Gram

**Note:** New products may be added to WooCommerce while the new site is being built. The new site will pull its product catalog from Zoho Inventory at launch — any products added to WooCommerce in the interim should also be added to Zoho Inventory.

### Invoicing & Payments → Zoho Books API

- Sales Orders created when B2B stores submit quotes
- Ken reviews in Zoho Books dashboard → converts to Invoice
- Invoice includes Stripe payment link (Zoho Books + Stripe integration)
- Payment recorded automatically when store pays

### Dealers & Partners → Zoho CRM API

- Active dealer contacts with addresses for the dealer locator
- "Become a Partner" form creates Leads in CRM
- Ken reviews and approves → Clerk account created → welcome email

### Auth & Sessions → Clerk

- B2B store login/registration (invitation-only after Ken approves partner application)
- **Email-only login** — no social auth, no username. Email + password.
- Clerk user metadata stores: Zoho CRM contact ID, pricing tier, company name
- Middleware protects `/portal/*` routes
- Role-based access: `public` (default), `partner` (B2B stores)

---

## Key Flows

### 1. B2B Quote/Order Flow

```
Store logs in (Clerk)
  → Browses /portal/catalog (sees bespoke pricing from Zoho Price List)
  → Adds items to cart (cart icon shows count badge)
  → Reviews quote at /portal/quote
  → Submits order
  → API route creates Sales Order in Zoho Books
  → Ken gets notified (email or Zoho notification)
  → Ken reviews in Zoho Books → converts to Invoice with Stripe payment link
  → Invoice emailed to store
  → Store pays via Stripe
  → Payment auto-recorded in Zoho Books
```

**Reorder:** Stores can view past orders at `/portal/orders` and reorder with one click — pre-fills the cart with the same items.

**Favorites:** Stores can save products to favorites at `/portal/favorites` for quick access.

### 2. Dealer Locator + "Contact This Dealer"

```
Customer visits /find-a-dealer (or clicks "Find Nearest Dealer" on a product page)
  → Map with address/radius search
  → Dealers pulled from Zoho CRM (active accounts with addresses)
  → On product pages: filtered to dealers who have ordered that collection
    (determined automatically from Zoho Sales Order history — no manual tagging)
  → Customer clicks a dealer → sees name, address, phone, distance
  → Clicks "Contact This Dealer"
  → Form: customer name, email, optional message
  → System sends email to dealer from cs@louisluso.com with:
    - Reply-To set to customer's email (dealer replies go directly to customer)
    - Customer's name + contact info
    - Product(s) they were viewing (if from a product page)
    - Link back to the product on louisluso.com
  → BCC sent to admin@louisluso.com and cs@louisluso.com
  → Customer sees confirmation: "We've sent your info to [Dealer Name]"
```

**Dealer-product association:** Hybrid approach combining automated ranking with manual override.

1. **Weighted ranking** — dealers ranked by order recency and frequency for each collection. A store that reordered Milan frames last month ranks above one that ordered once a year ago. Scoring factors: days since last order (recency), total orders for that collection (frequency), total units ordered (volume).
2. **Manual override** — Ken can tag a dealer in Zoho CRM as "active" or "inactive" for specific collections, overriding the automated ranking. An "active" override pins the dealer to the list; an "inactive" override removes them regardless of purchase history.
3. **Auto-expiry** — dealers with no orders for a collection in the last 18 months (configurable) and no manual "active" override are automatically dropped from that collection's dealer list.
4. **Results cached** — dealer-collection associations rebuilt periodically (e.g., daily) and cached to avoid excessive API calls on every page load.

### 3. Become a Partner

```
Visitor fills out form at /become-a-partner
  → Fields:
    - Company* 
    - Contact name*
    - Email*
    - Phone number*
    - Address*
    - City*
    - State*
    - Zip code*
    - How did you hear about us?* (dropdown)
    - If other, please specify (conditional text field)
    - Upload a signed credit application (file upload, max 20MB)
  → API route creates Lead in Zoho CRM with status "New"
  → Credit application file attached to the Lead record in Zoho CRM via attachments API
  → Ken reviews in Zoho CRM
  → If approved:
    → Ken (or automated workflow) creates Clerk account
    → Assigns pricing tier in Clerk metadata + Zoho CRM
    → Welcome email sent with login credentials
  → If rejected:
    → Polite rejection email sent
```

### 4. Product Catalog Display

```
Public visitor browses /eyeglasses/milan-series
  → Next.js ISR page (revalidated every ~15 min)
  → Products fetched from Zoho Inventory API (item groups with variants)
  → Each product shows: images, name, SRP price, available colors
  → Click → /products/[slug] detail page
  → Detail shows: all images, color variant selector, SRP, specs (material, size, weight)
  → "Find Nearest Dealer" button

If visitor is logged in as B2B partner:
  → Same pages but SRP replaced with their bespoke pricing
  → "Add to Quote" button appears alongside "Find Nearest Dealer"
```

### 5. Cart Behavior

- Cart icon in header with count badge showing number of items
- B2B only — public visitors don't see a cart
- Cart state persisted per session (Clerk user)
- Cart stored client-side (localStorage or state) until submission
- On submit, cart contents become a Zoho Books Sales Order

---

## Data Migration

### Product Images → Cloudinary

Product images currently live in WooCommerce. Migration plan:

1. **Export script** — pull all products from WooCommerce API, download every image URL, save locally organized by SKU
2. **Naming convention** — `products/{SKU}/{view}.jpg` (e.g., `products/SG1011_C2/front.jpg`, `products/SG1011_C2/side.jpg`)
3. **Bulk upload to Cloudinary** — use Cloudinary's upload API or CLI
4. **No URL storage in Zoho** — website constructs Cloudinary URLs from SKU automatically: `https://res.cloudinary.com/{cloud_name}/image/upload/products/{SKU}/{view}.jpg`
5. **Auto-optimization** — Cloudinary serves WebP/AVIF, auto-resizes per device, lazy loading via Next.js `<Image>` component

**Cloudinary free tier:** 25K transformations/month, 25GB storage, 25GB bandwidth. Sufficient for ~288 products with multiple images each.

### Product Images — Gap Analysis

Not all products in Zoho Inventory have images. Migration plan:

1. **Audit script** — compare products in Zoho Inventory vs WooCommerce, identify which are missing images in Zoho
2. **Pull missing images from WooCommerce** — download product images for any products that exist in WooCommerce but lack images in Zoho
3. **Upload all images to Cloudinary** — organized by SKU naming convention
4. **Fallback placeholder** — products without images in either system get a generic LOUISLUSO placeholder (frame silhouette or logo) until photos are taken

### Product Data → Zoho Inventory

Products are already in Zoho Inventory — no product data migration needed. Verify:
- All ~288 products exist in Zoho Inventory with correct variants and SKUs
- Stock levels are current
- Price lists match the 2026 price sheet
- SKU naming is consistent (needed for Cloudinary image mapping)
- Identify products missing from Zoho that exist in WooCommerce (if any)

### From WordPress

Content to migrate (copy/paste, not automated):
- About Us page content
- Why LOUISLUSO page content
- Contact page details
- Store locator data → verify dealers are in Zoho CRM

### Retirement

Once the new site is live on louisluso.com:
- Shut down AWS Lightsail instance
- Cancel any WordPress/WooCommerce subscriptions
- Keep Route 53 DNS (point to Vercel)
- Keep domain registration at Bluehost (expires Sep 2026)

---

## What Gets Retired

- WordPress / WooCommerce site
- AWS Lightsail instance
- WooCommerce stock management scripts (`scripts/` folder)
- HubSpot tracking (replace with Google Analytics 4)
- All WordPress plugins (Elementor, Savoy theme, LiteSpeed Cache, WP Google Maps, Contact Form 7, Webba Booking, BeRocket, etc.)
- Legacy Universal Analytics (UA-198347690-1) → GA4

## What Stays

- Email outreach CLI system (`email/` folder) — not migrating to Zoho CRM Cadences yet
- Google Workspace (cs@louisluso.com, admin@louisluso.com)
- Domain registration at Bluehost
- DNS at Route 53

---

## Security

Most security is delegated to trusted services, but our application layer must be tight:

**Auth & Access**
- Clerk handles auth, sessions, and password hashing — no custom auth code
- Email-only login with strong password requirements
- `/portal/*` routes protected by Clerk middleware — server-side check, not client-side
- Role-based access enforced at the API route level (not just UI hiding)

**API & Data**
- All Zoho API credentials stored in environment variables (Vercel env, never in code)
- Next.js API routes proxy all Zoho calls — credentials never exposed to the browser
- Input validation with Zod on all form submissions and API routes
- Rate limiting on public-facing API routes (partner application, contact dealer, contact form) to prevent abuse
- CSRF protection via Next.js built-in mechanisms

**Payments**
- No card data touches our servers — Stripe handles all payment processing via Zoho Books payment links
- PCI compliance delegated entirely to Stripe

**File Uploads**
- Credit application uploads validated for file type and size (max 20MB) before forwarding to Zoho CRM
- Files never stored on our server — streamed directly to Zoho attachment API

**Metered Service Abuse Protection**
- All services with free tier limits or per-use billing must be protected from abuse
- **Mapbox:** Map only loads on `/find-a-dealer` page, lazy-loaded on scroll. Rate limit the geocoding API route (per-IP, per-minute). Mapbox API key restricted by domain (only louisluso.com).
- **Cloudinary:** Images served via Next.js `<Image>` component with CDN caching — repeated loads hit the cache, not Cloudinary. Restrict transformations to predefined presets only.
- **Vercel:** Edge-level DDoS protection included on Pro plan. Serverless function invocations protected by per-IP rate limiting on all public API routes.
- **Zoho API:** All calls go through server-side API routes (never client-side). Rate limited by both our middleware and Zoho's own limits.
- **Stripe:** No direct exposure — payments happen on Zoho-hosted pages.

**Infrastructure**
- HTTPS enforced (Vercel default)
- Security headers (CSP, X-Frame-Options, etc.) configured in Next.js
- Vercel handles DDoS protection at the edge
- No database to secure — all data lives in Zoho's infrastructure
- Environment variables per-environment (dev/staging/prod) — no shared secrets
- All third-party API keys restricted by domain/referrer where supported

**Monitoring**
- Vercel logs for API route errors
- Clerk dashboard for auth anomalies
- Zoho audit logs for data access

---

## Design Direction

### Reference Sites
- **Persol** (persol.com) — premium editorial feel, warm tones, cinematic hero imagery, dark header, generous whitespace
- **Edward Beiner** (edwardbeiner.com) — luxury minimalist, off-white/cream backgrounds, purple accents, card-based product grid, color variant selectors
- **SEE Eyewear** (seeeyewear.com) — clean minimalist, black/white with burgundy accent, uppercase nav, monospace headings, sharp corners, generous spacing
- **Gentle Monster** (gentlemonster.com) — bold editorial, clean navbar design (reference for nav specifically)
- **Oliver Peoples** (oliverpeoples.com) — ultra-minimal luxury, near-black text on white, flat borderless product cards, serif + sans-serif pairing, left-aligned text

### Design Principles (derived from references)
- **Premium minimalist** — clean, lots of whitespace, product-first
- **Restrained color palette** — mostly black/white/off-white with one accent color
- **Typography contrast** — sans-serif for UI/nav, potential serif for editorial headlines
- **Flat product cards** — no borders, no heavy shadows, clean image presentation
- **Large product photography** — clean backgrounds, let the frames speak
- **Uppercase navigation** — letter-spaced, clean, minimal
- **Smooth transitions** — subtle hover effects and page transitions
- **Dark or transparent header** — clean nav that doesn't compete with hero content

### Decisions still needed
- Exact color palette (accent color — brand-specific)
- Typography selection (specific font pairings)
- Component library / CSS framework (Tailwind most likely)

### Confirmed
- Heroicons for the icon library
- Fully responsive / mobile-friendly — all pages and the B2B portal must work well on phone and tablet
- Tailwind CSS (assumed — confirm during implementation)

---

## Collections (from current site)

### Eyeglasses (20 collections)
- Milan Series (NEW)
- Dr. GRAM (NEW) — **discontinued per 2026 price list**
- Rimless Air Series (NEW)
- Skylite (NEW)
- Grand Collection (NEW)
- Classic
- Eye's Cloud Kids
- Junior Series
- London Collection
- Urban Collection
- Louisluso Titanium
- Signature Series
- Signature Plus Series
- Manomos Glasses (BTS Collection)
- TANI
- Tandy Series
- Tandy Titanium
- Veritas Classic
- Veritas Series
- Close Out
- CLROTTE — **discontinued per 2026 price list**
- SNF

### 2026 New Collections
- Signature Series (SG4041–4048) — 8 models, 5 colors/model
- London Titanium (LC9050–9055) — 6 models, 5 colors/model
- Urban Titanium (LU3001–3005) — 5 models, 3 colors/model

### Sunglasses
- Manomos Sunglasses (BTS Collection)

### Accessories
- Cases, cleaning kits, etc.

---

## Open Questions

1. **Appointment booking:** Tabled for now. Current site has it but it's unused (not linked in nav). Can revisit later — Zoho Bookings (included in Zoho One) would be the simplest option if needed.
2. **Google Analytics 4:** Need to create a GA4 property to replace the legacy UA tracking (UA-198347690-1 is sunset and likely not collecting data).
3. **Zoho One timeline:** User is setting up with a Zoho sales rep. Site can launch against current Inventory Standard + free tier Books/CRM, then upgrade seamlessly since APIs are identical regardless of plan.
4. **Design direction:** Awaiting reference sites from user. Must be decided before frontend implementation begins. Tailwind CSS is the likely framework.
5. **Product images:** Are current WooCommerce product images also in Zoho Inventory, or do they need to be uploaded? This determines whether there's an image migration step.
6. **Dealer data completeness:** Are all ~800 active dealers currently in Zoho CRM with full addresses (street, city, state, zip)? The dealer locator depends on geocodable addresses.
7. **"NEW" badges:** Manual custom field in Zoho Inventory. Ken flags collections as "NEW" and removes the flag when ready. Website reads the field and displays the badge.
    - **"Temporarily Out of Stock" tag:** When a product/variant has zero stock in Zoho Inventory, display a "Temporarily Out of Stock" badge on the product card and detail page. Product remains visible and browsable — not hidden. "Add to Quote" button is disabled for out-of-stock items (no backorders). A "Notify When In Stock" button replaces it — B2B stores can subscribe to get an email when the item is restocked.
8. **Map provider:** Mapbox (50K free map loads/mo, 100K free geocoding requests/mo). Replaces Google Maps from the current site.
9. **Email service:** Gmail API (already set up and working via Google Workspace). Used for "Contact This Dealer" emails, partner application confirmations, and welcome emails.
10. **Zoho OAuth setup:** Need to register a Server-based Application in Zoho API Console for the new site. Separate from the existing WooCommerce API keys.
11. **Stripe account:** Need to create a Stripe account for Q-Vision Optics / LOUISLUSO and connect it to Zoho Books for invoice payment links.
12. **Sales order notifications:** Multiple people (not just Ken) should receive notifications and be able to approve sales orders in Zoho Books. Determine who gets access.

---

## Setup Checklist (before implementation)

| Task | Owner | Status |
|---|---|---|
| Create Zoho API Console app (Server-based Application) — scopes: Inventory, Books, CRM | Shawn | Done (2026-04-08) |
| Create Vercel account + project | Shawn | Done (qv-ision/louisluso) |
| Create Clerk account + application | Shawn | Done (test keys, email-only) |
| Create Stripe account | Shawn/Ken | Pending |
| Create Cloudinary account | Shawn | Done (cloud: dctwzk6sn) |
| Create Upstash Redis database | Shawn | Done (free tier) |
| Create Mapbox account | Shawn | Pending |
| Set up GA4 property | Shawn/Ken | Pending |
| Confirm AWS Route 53 access (for DNS cutover to Vercel) | Shawn/Ken | Pending |
| Confirm Bluehost domain auto-renewal is active | Ken | Pending |
| Connect Stripe to Zoho Books | Ken | Pending (after Zoho One migration) |
| Zoho One migration (via sales rep) | Ken | Pending (Enterprise Trial active) |
| Provide design reference sites | Shawn | Done (Persol, Edward Beiner, SEE, Gentle Monster, Oliver Peoples) |

---

## Reference Data

- **2026 Price List:** Google Sheet — `https://docs.google.com/spreadsheets/d/1CDssE5KCQQGXGCiV1MWelLTAEFvGDpToDTcznJFemOk/edit`
- **Current site audit:** See brainstorming session (2026-04-08) for full sitemap of current louisluso.com
- **WooCommerce API:** Still active at louisluso.com — available for data verification during migration
- **Stock update docs:** `docs/stock-update-guide-2026-03-04.md`
