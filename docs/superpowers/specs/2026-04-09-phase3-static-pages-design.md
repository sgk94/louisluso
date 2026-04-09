# Phase 3: Static Pages & Navigation — Design Spec

## Overview

Build the shared navigation/footer and all static content pages: homepage, about, why LOUISLUSO, contact, become a partner, privacy, and terms. Establishes the visual identity (color palette, typography, layout system) that carries through the entire site.

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-black` | `#0a0a0a` | Primary text, dark backgrounds |
| `--color-white` | `#FFFFFF` | Backgrounds |
| `--color-off-white` | `#FAFAF9` | Alternate section backgrounds |
| `--color-warm-bg` | `#F0ECE6` | Warm hero/feature backgrounds |
| `--color-bronze` | `#8B6F4E` | Primary accent — CTAs, links, highlights |
| `--color-bronze-light` | `#C4A882` | Secondary accent — hover states, borders |
| `--color-gray-900` | `#1A1A1A` | Headings on light bg |
| `--color-gray-600` | `#666666` | Body text |
| `--color-gray-400` | `#999999` | Muted text, placeholders |
| `--color-gray-200` | `#E5E5E5` | Borders, dividers |
| `--color-gray-100` | `#F5F5F5` | Subtle backgrounds |

### Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Hero headline | Cormorant Garamond | 400 | 48-64px | normal |
| Section headline | Cormorant Garamond | 500 | 32-40px | normal |
| Subheadline | Cormorant Garamond | 400 | 24px | normal |
| Nav links | DM Sans | 400 | 12-13px | 1.5px, uppercase |
| Body text | DM Sans | 300-400 | 15-16px | normal |
| Button/CTA | DM Sans | 500 | 13px | 2px, uppercase |
| Caption/label | DM Sans | 400 | 11-12px | 1px, uppercase |

Google Fonts: `Cormorant+Garamond:wght@400;500;600` + `DM+Sans:wght@300;400;500;600`

### Spacing System

Base unit: 4px. Common values: 8, 12, 16, 24, 32, 48, 64, 96, 128.

Section padding: `py-24` (96px) on desktop, `py-16` (64px) on mobile. Content max-width: `max-w-7xl` (1280px).

---

## Shared Components

### Navigation

**Structure:** Light header, centered logo, dark tagline bar above (Oliver Peoples style).

```
┌──────────────────────────────────────────────────────────────┐
│  [dark bar]  THE WORLD'S LIGHTEST FRAMES              FB IG  │
├──────────────────────────────────────────────────────────────┤
│  Eyeglasses  Sunglasses  Accessories    LOUISLUSO    Find a Dealer  ♡  Login │
└──────────────────────────────────────────────────────────────┘
```

**Top bar:**
- Background: `#0a0a0a`
- Center: "THE WORLD'S LIGHTEST FRAMES" in bronze (`#8B6F4E`), DM Sans 11px, uppercase, tracking 1.5px
- Right: Facebook + Instagram icons (Heroicons or simple text links), gray-600

**Main nav bar:**
- Background: white, bottom border `#E5E5E5`
- Left: nav links — Eyeglasses, Sunglasses, Accessories
- Center: LOUISLUSO wordmark in Cormorant Garamond 26px, letter-spacing 4px
- Right: Find a Dealer, Favorites (heart icon), Login/Account
- All nav links: DM Sans 12px, uppercase, tracking 1.5px, `#333`
- Hover: bronze underline or color shift

**Eyeglasses mega-menu:** On hover/click, dropdown showing all eyeglasses collections in a grid. 3-4 columns, collection names as links. Simple — no images in dropdown.

**Mobile:** Hamburger menu icon replaces nav links. Slide-out drawer with all links. Logo stays centered. Top bar collapses to icon-only.

**Sticky behavior:** Nav sticks to top on scroll. Top bar scrolls away.

### Footer

```
┌──────────────────────────────────────────────────────────────┐
│  LOUISLUSO                                                    │
│  The World's Lightest Frames                                  │
│                                                               │
│  Shop              Company            Connect                 │
│  Eyeglasses        Why LOUISLUSO      Find a Dealer           │
│  Sunglasses        About Us           Become a Partner        │
│  Accessories       Contact Us         Facebook                │
│                    Privacy            Instagram               │
│                    Terms                                      │
│                                                               │
│  © 2026 LOUISLUSO. All rights reserved.                       │
└──────────────────────────────────────────────────────────────┘
```

- Background: `#0a0a0a`, text: white/gray
- Logo in Cormorant Garamond, tagline in bronze
- 3-column link grid: Shop, Company, Connect
- Copyright bar at bottom
- Mobile: stacks to single column

---

## Pages

### `/` — Homepage

**Sections (top to bottom):**

1. **Hero section**
   - Full-width, `--color-warm-bg` background (placeholder — will be replaced with photography)
   - Centered headline: "Engineered for Comfort" in Cormorant Garamond 56px
   - Subline: "Premium eyewear crafted from ULTEM — lighter than titanium, stronger than steel" in DM Sans 16px
   - CTA button: "Explore the Collection" in bronze outline style
   - Min height: 70vh

2. **Featured Collections** (2 cards)
   - Two large cards side by side: Signature Series + London Collection
   - Each card: collection image (placeholder), name, "Shop Now →" link
   - Aspect ratio 3:2, with text overlay or below image
   - Below cards: "View All Collections →" link centered, bronze text

3. **Brand Promise** strip
   - 3 columns on off-white background
   - "Ultra-Lightweight" — ULTEM material, under 10g
   - "Premium Quality" — FDA/ECO compliant, Korean engineering
   - "500+ Dealers" — trusted by optical stores nationwide
   - Each with a Heroicon, headline, one-sentence description

4. **"Why LOUISLUSO"** teaser
   - Split layout: text left, placeholder image right
   - Headline: "The World's Lightest Frames"
   - Brief paragraph about ULTEM technology
   - CTA: "Learn More →" linking to `/why-louisluso`

5. **Become a Partner** CTA
   - Dark background (`#0a0a0a`), bronze accent
   - "Partner With Us" headline
   - Brief text about B2B wholesale program
   - CTA button: "Apply Now" linking to `/become-a-partner`

### `/why-louisluso` — Why LOUISLUSO

Content page explaining brand differentiation:

- **Hero:** "Why LOUISLUSO?" headline, brief intro
- **ULTEM Material:** What it is, why it matters (lightweight, flexible, hypoallergenic)
- **Specifications:** Under 10g weight, FDA-approved, ECO-certified
- **Comparison:** ULTEM vs Acetate vs Metal vs Titanium (simple table or cards)
- **Korean Design:** Heritage, craftsmanship, design philosophy
- **CTA:** "Find a Dealer" or "Explore Collections"

Content source: pull from current WordPress site + spec. Placeholder copy if current site doesn't have enough.

### `/about` — About Us

- **Hero:** "About LOUISLUSO" headline
- **Company Story:** Q-Vision Optics, Arlington Heights IL, founding story
- **Mission/Vision/Values:** Brief section
- **Distribution:** "Trusted by 500+ optical stores across North America"
- **CTA:** "Become a Partner" link

Content source: current WordPress site "About Us" page.

### `/contact` — Contact Us

- **Split layout:** Form left, map + info right
- **Contact form fields:**
  - Name (required)
  - Email (required)
  - Phone (optional)
  - Subject (dropdown: General Inquiry, Product Question, Partnership, Other)
  - Message (required, textarea)
- **Form submission:** Sends email via Gmail API to cs@louisluso.com
- **Rate limited:** Per-IP via Upstash
- **Company info:**
  - Q-Vision Optics, Inc.
  - Address: 3413 N. Kennicott Ave, Ste B, Arlington Heights, IL
  - Phone: (from current site — verify with Ken)
  - Email: cs@louisluso.com
- **Map:** Static Google Maps embed centered on the business address

### `/become-a-partner` — Partnership Application

- **Intro section:** "Partner With LOUISLUSO" headline, brief description of B2B program benefits
- **Form fields (all required unless noted):**
  - Company name
  - Contact name
  - Email
  - Phone
  - Street address
  - City
  - State (dropdown — US states)
  - Zip code
  - "How did you hear about us?" (dropdown: Friend, Advertisement, Social Media, Other)
  - If "Other" selected: text field appears (conditional)
  - Credit application upload (PDF only, max 20MB)
- **Form submission:**
  - Creates Lead in Zoho CRM (status: "New")
  - Uploads credit application PDF to Lead as attachment via Zoho CRM attachments API
  - File streams directly to Zoho — never stored on our server
  - Rate limited per-IP
- **Security:**
  - Server-side file type validation (MIME type + magic bytes — must be application/pdf)
  - 20MB size limit enforced server-side
  - Zod validation on all form fields
- **Success state:** "Thank you" message with "We'll review your application and get back to you within 2-3 business days"

### `/privacy` — Privacy Policy

- Simple content page with legal text
- Placeholder content initially — Ken to provide actual privacy policy
- Styled consistently (Cormorant Garamond headline, DM Sans body)

### `/terms` — Terms of Service

- Same as privacy — placeholder content, consistent styling
- Ken to provide actual terms

---

## API Routes

### `POST /api/contact`

Contact form submission.

- Validates with Zod: name, email, phone (optional), subject, message
- Rate limited per-IP (Upstash)
- Sends email via Gmail API to cs@louisluso.com
- Returns `{ success: true }` or `{ error: string }`

### `POST /api/become-a-partner`

Partnership application form.

- Validates with Zod: company, name, email, phone, address, city, state, zip, referralSource
- Accepts multipart form data (for file upload)
- Server-side PDF validation (MIME type check)
- Creates Lead in Zoho CRM via `createLead()`
- If file attached: uploads to Lead via `attachFile()` — streamed, not stored
- Rate limited per-IP
- Returns `{ success: true }` or `{ error: string }`

---

## Responsive Breakpoints

| Breakpoint | Width | Nav behavior |
|---|---|---|
| Mobile | < 640px | Hamburger menu, stacked layouts, single column |
| Tablet | 640-1024px | Hamburger menu, 2-column grids |
| Desktop | > 1024px | Full nav, side-by-side layouts |

All pages must work well on mobile. The nav mega-menu becomes a simple list in the mobile drawer.

---

## Implementation Notes

### Font Loading

Use `next/font/google` to self-host Cormorant Garamond and DM Sans. This avoids layout shift and improves performance:

```ts
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
```

### Tailwind Theme Extension

Add the color palette and font families to the Tailwind config so they're available as utilities (`text-bronze`, `font-heading`, `font-body`).

### Content Strategy

- Homepage and Why LOUISLUSO need copy written — pull what exists from current WordPress site, supplement with product/brand info from the spec
- Privacy and Terms are placeholder — Ken provides final legal text
- Contact page needs the actual business address and phone from the current site

### Form Components

Build reusable form components:
- `TextInput` — label, input, error message
- `TextArea` — label, textarea, error message
- `Select` — label, dropdown, error message
- `FileUpload` — label, drag-and-drop zone, file type/size validation, error message
- `SubmitButton` — loading state, disabled state

These are client components (`"use client"`) since they manage form state.

---

## Testing

- Unit tests for form validation schemas (Zod)
- Integration tests for `/api/contact` and `/api/become-a-partner` (mock Gmail and Zoho)
- Component tests for form components (render, validation, error states)
- Component tests for navigation (desktop, mobile, mega-menu)
- Visual check: all pages render correctly at mobile/tablet/desktop widths
