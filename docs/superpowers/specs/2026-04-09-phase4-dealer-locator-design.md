# Phase 4: Dealer Locator — Design Spec

## Overview

Store finder page at `/find-a-dealer` that lets customers locate nearby optical stores carrying Louis Luso frames. Dark-themed Mapbox map with bronze/gold pins, sidebar dealer list, and "Contact This Dealer" modal with email flow.

Frontend-first build: mock dealer data now, Zoho CRM integration later.

---

## Page Layout

### Desktop (`/find-a-dealer`)

- **Map area (70%)** — dark Mapbox style, full height
  - Search bar overlay (top-left): text input for city/state/zip + "Near me" geolocation button
  - Zoom controls (bottom-right)
  - Bronze pins for dealers, gold glow for selected/hovered
- **Sidebar (30%)** — dark background (`#111`), scrollable dealer card list
  - Header: "Dealers Near You" + count + radius
  - Dealer cards sorted by distance

### Mobile

- Map stacks on top (~55% viewport height)
- Dealer list below, scrollable
- Same dark theme, compact cards
- Contact modal renders as full-screen overlay

---

## Initial Load Behavior

1. Request browser geolocation via `navigator.geolocation.getCurrentPosition()`
2. **If granted:** zoom to user location (zoom level ~11), fetch dealers within 25mi radius, show sorted by distance
3. **If denied/unavailable:** show US-wide view (zoom ~4), all dealers visible, search bar prominent with placeholder "Enter your zip code to find nearby dealers"

---

## Search

- Text input geocodes via Mapbox Geocoding API (client-side, forward geocoding)
- On search: re-center map to result, filter dealers by distance (25mi default)
- "Near me" button re-triggers geolocation
- Debounced input (300ms) for autocomplete suggestions (Mapbox Search)

---

## Dealer Cards (Sidebar)

Each card displays:
- **Store name** (left) + **distance** in miles (right, bronze when selected)
- **City, State** (secondary text)
- **3 action buttons:**
  - **Call** — `tel:` link to dealer phone
  - **Directions** — opens Google Maps directions in new tab
  - **Contact** — opens Contact This Dealer modal

### Card States

- **Default:** dark background, muted text, subtle border
- **Selected/Active:** bronze left border (3px), slightly lighter background (`rgba(139,111,78,0.08)`), white text for store name, bronze distance
- **Hover:** subtle background lighten

### Interactions

- Clicking a card → pans/zooms map to that dealer's pin, highlights pin
- Clicking a map pin → scrolls sidebar to that card, highlights it

---

## Map Pins

- **Default:** 14px bronze circle (`#8B6F4E`) with outer glow, 2px `#c4a265` border
- **Selected/Hovered:** 20px gold circle (`#c4a265`) with stronger glow + outer ring
- **Cluster pins** (future): circle with count, sized by cluster size

---

## Contact This Dealer Modal

### Trigger
- Click "Contact" button on a dealer card
- Optional: pass `productSlug` query param when navigating from a product page

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Your Name | text | Yes | |
| Your Email | email | Yes | |
| Message | textarea | No | Placeholder: "I'm interested in trying on..." |

### Product Context
- If user navigated from a product page (via `?product=SP1018` query param), show a product context card below the form:
  - Product image thumbnail (from Cloudinary)
  - Product name + collection name
  - "Asking about: SP1018 — Signature Series"
- This info is included in the email to the dealer

### On Submit
1. POST to `/api/dealers/[id]/contact`
2. Server validates via Zod schema
3. Rate limit check (per IP, 5 requests/minute)
4. Send email via Gmail API:
   - **From:** `cs@louisluso.com`
   - **To:** dealer's email
   - **Reply-To:** customer's email
   - **BCC:** `admin@louisluso.com`, `cs@louisluso.com`
   - **Subject:** "Customer Inquiry via LOUISLUSO — [Customer Name]"
   - **Body:** Customer name, email, message, product info (if applicable), link back to product page
5. Show success state: "We've sent your info to [Dealer Name]. They'll reply directly to your email."

### Modal Design
- Dark background (`#111`) with bronze accent border
- Overlay backdrop (`rgba(0,0,0,0.7)`)
- Close button (X) top-right
- Escape key closes modal
- Click outside closes modal
- Mobile: full-screen overlay with sticky submit button

---

## Data Layer

### Types (`lib/dealers/types.ts`)

```typescript
interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface ContactDealerInput {
  customerName: string;
  customerEmail: string;
  message?: string;
  productSlug?: string;
}
```

### Mock Data (`lib/dealers/mock-data.ts`)

~10 mock dealers in the Chicago/Illinois area with realistic names, addresses, phone numbers, and coordinates. This will be swapped for Zoho CRM data in a later phase.

### Zod Schema (`lib/schemas/contact-dealer.ts`)

```typescript
const contactDealerSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  message: z.string().max(1000).optional(),
  productSlug: z.string().max(100).optional(),
});
```

---

## API Routes

### `GET /api/dealers`

- Returns all dealers (mock data for now)
- Response: `{ dealers: Dealer[] }`
- Future: accepts `?lat=X&lng=Y&radius=25` query params for server-side filtering

### `POST /api/dealers/[id]/contact`

- Validates request body with `contactDealerSchema`
- Looks up dealer by `id` from mock data
- Rate limit: 5 requests/minute per IP
- Sends email via Gmail API (with BCC support)
- Returns `{ success: true }` or error

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/find-a-dealer/page.tsx` | Page component (server component wrapper) |
| `app/components/DealerMap.tsx` | Mapbox GL map (client component, `"use client"`) |
| `app/components/DealerList.tsx` | Sidebar dealer list |
| `app/components/DealerCard.tsx` | Individual dealer card with action buttons |
| `app/components/ContactDealerModal.tsx` | Contact form modal |
| `lib/dealers/types.ts` | Dealer type definitions |
| `lib/dealers/mock-data.ts` | Mock dealer data (~10 dealers) |
| `lib/schemas/contact-dealer.ts` | Zod validation schema |
| `app/api/dealers/route.ts` | GET dealers endpoint |
| `app/api/dealers/[id]/contact/route.ts` | POST contact dealer endpoint |

### Modified Files

| File | Change |
|------|--------|
| `lib/env.ts` | Add `NEXT_PUBLIC_MAPBOX_TOKEN` |
| `lib/gmail.ts` | Add optional `bcc: string[]` parameter to `sendEmail()` |

---

## Dependencies

### New Packages

- `mapbox-gl` — Mapbox GL JS map rendering
- `@types/mapbox-gl` — TypeScript type definitions

### Existing (reused)

- `@upstash/ratelimit` — rate limiting on contact endpoint
- `googleapis` — Gmail API for email sending
- `zod` — form validation
- `@heroicons/react` — icons (search, location, phone, map)

---

## Environment Variables

| Variable | Type | Notes |
|----------|------|-------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | Mapbox GL access token, restricted to `louisluso.com` + `localhost` |

---

## Design Tokens

All tokens from existing design system:

- **Bronze:** `#8B6F4E` (pins, accents, active borders)
- **Bronze light:** `#c4a265` (selected pins, hover states)
- **Dark bg:** `#111` (sidebar, modal)
- **Darker bg:** `#0a0a0a` (page background)
- **Map style:** Mapbox Dark (`mapbox://styles/mapbox/dark-v11`)
- **Pin glow:** `box-shadow: 0 0 12px rgba(139,111,78,0.6)`
- **Selected glow:** `box-shadow: 0 0 20px rgba(196,162,101,0.8)`

---

## Testing

### Unit Tests
- `__tests__/lib/schemas/contact-dealer.test.ts` — schema validation (valid/invalid inputs)
- `__tests__/app/api/dealers.test.ts` — GET dealers endpoint
- `__tests__/app/api/dealers-contact.test.ts` — POST contact endpoint (validation, rate limiting, email sending)

### Component Tests
- `__tests__/app/components/DealerCard.test.ts` — renders card, action buttons, click handlers
- `__tests__/app/components/DealerList.test.ts` — renders list, selection state
- `__tests__/app/components/ContactDealerModal.test.ts` — form validation, submit, close behavior

---

## Deferred to Backend Integration (later)

These items require Zoho CRM data and will be built when dealer data is ready:

- Zoho CRM Contact fetch (replace mock data)
- Geocoding dealer addresses (Mapbox Geocoding API → store lat/lng)
- Dealer-collection association algorithm (ranking by order history)
- Manual override fields in Zoho CRM
- Auto-expiry of inactive dealers (18 months no orders)
- Server-side distance filtering
- Dealer clustering on map
- Cache layer for dealer data (Upstash Redis)
