# Phase 5a: Partner Auth + Portal Foundation — Design Spec

## Overview

Unlock partner features on the existing site via Clerk auth. No separate portal app — logged-in partners see the same site with a user menu, partner pricing (Phase 5b), and "Add to Quote" (Phase 5c). This phase builds the auth flow, auto-matching, navigation changes, dashboard, account page, and invite script.

---

## Partner Creation Flow

1. Dealer submits `/become-a-partner` → Zoho CRM Lead created (already built)
2. Ken reviews in Zoho CRM → converts Lead to Contact
3. Ken runs `pnpm portal:invite --email dealer@store.com` → branded approval email via Gmail API
4. Partner clicks signup link → Clerk hosted sign-up page (email + password only)
5. First `/portal` visit → system auto-matches email to Zoho CRM Contact
6. Match found → sets Clerk `publicMetadata`: role, zohoContactId, company, pricingPlanId (if assigned)
7. Partner is fully set up — zero manual Clerk metadata entry

---

## Auto-Matching Logic

Triggered on portal access when user has no `role: "partner"` in metadata.

### Steps

1. Read `user.publicMetadata.role` from Clerk
2. If `role === "partner"` → proceed to portal (already matched)
3. If no role → call Zoho CRM API: search Contacts by user's email
4. **Match found:**
   - Set Clerk `publicMetadata`: `{ role: "partner", zohoContactId: "<id>", company: "<Account_Name>" }`
   - If Ken assigned a Price List in Zoho for this Contact → also set `pricingPlanId`
   - Proceed to portal
5. **No match:**
   - Show "Account pending approval" page
   - Message: "Your partner application is being reviewed. Contact cs@louisluso.com for questions."
   - Link back to homepage
6. Result cached in Clerk metadata — subsequent visits skip the Zoho lookup

### Clerk Public Metadata Shape

```typescript
interface PartnerMetadata {
  role: "partner";
  zohoContactId: string;
  company: string;
  pricingPlanId?: string; // optional — omit = listing price (item.rate)
}
```

---

## Navigation Changes

### Current Nav (unchanged for public)

```
[Eyeglasses ▾] [Sunglasses] [Accessories]    LOUISLUSO    [Find a Dealer] [♡] [Login]
```

### Nav When Logged In as Partner

```
[Eyeglasses ▾] [Sunglasses] [Accessories]    LOUISLUSO    [Find a Dealer] [♡] [User Icon ▾]
```

User icon dropdown menu:
- **Dashboard** → `/portal`
- **Orders** → `/portal/orders` (disabled, "Coming soon")
- **Favorites** → `/portal/favorites` (disabled, "Coming soon")
- **Account** → `/portal/account`
- **Sign Out** → Clerk sign-out

### Styling

- User icon: `UserCircleIcon` from Heroicons, same size as heart icon
- Dropdown: dark background (`#111`), matches dealer locator card styling
- Active item: bronze text
- Disabled items: gray text with "(Coming soon)" suffix
- "Sign Out" at bottom with subtle separator

### Mobile

- User icon in mobile menu header area
- Menu items added to bottom of mobile menu with "Partner" section header

---

## Pages

### `/portal` — Dashboard

Minimal welcome page:

- **Header:** "Welcome back, [First Name]"
- **Subline:** Company name in bronze
- **Quick-action cards** (3-column grid, 1 on mobile):
  - **Browse Catalog** → `/eyeglasses` — "View our collections with your pricing"
  - **View Orders** → `/portal/orders` — "Coming soon" (disabled state)
  - **Account Settings** → `/portal/account` — "View your account details"
- Dark background matching dealer locator aesthetic (`#0a0a0a`)

### `/portal/account` — Account Info (Read-Only)

Displays partner info pulled from Zoho CRM Contact:

- **Company name** (Account_Name)
- **Contact name** (First_Name + Last_Name)
- **Email** (Email)
- **Phone** (Phone)
- **Address** (Mailing_Street, Mailing_City, Mailing_State, Mailing_Zip)
- **Pricing tier** — shows "Standard" (listing price) or Price List name if bespoke

Footer note: "Need to update your information? Contact cs@louisluso.com"

Dark theme, same styling as dealer locator pages.

---

## Invite Script

### Command

```bash
pnpm portal:invite --email dealer@store.com [--dry-run]
```

### Behavior

1. Look up Contact in Zoho CRM by email
2. If not found → error: "No Zoho CRM Contact found for this email"
3. If found → send branded HTML email via Gmail API:
   - **From:** cs@louisluso.com
   - **Subject:** "Welcome to the LOUISLUSO Partner Portal"
   - **Body:**
     - Greeting with contact's first name
     - "Your partner application has been approved"
     - "Create your account" button/link → Clerk hosted sign-up URL
     - Brief instructions: "Sign up with this email address to access wholesale pricing and ordering"
     - LOUISLUSO branding/footer
4. `--dry-run` flag: prints email content without sending

### File

`scripts/portal-invite.ts` — CLI script using existing Gmail API utility.

---

## API Routes

### `GET /api/portal/account`

- Auth: requires Clerk session (partner role)
- Reads `zohoContactId` from Clerk metadata
- Fetches Contact from Zoho CRM by ID
- Returns: `{ company, firstName, lastName, email, phone, address, pricingTier }`
- Rate limited per IP

### `POST /api/portal/match`

- Auth: requires Clerk session (any authenticated user)
- Reads user's email from Clerk
- Searches Zoho CRM Contacts by email
- Match found → updates Clerk publicMetadata via Clerk Backend API → returns `{ matched: true, company }`
- No match → returns `{ matched: false }`
- Rate limited per IP (prevent abuse)

---

## Zoho CRM Extensions

### New Function: `getContactByEmail`

Add to `lib/zoho/crm.ts`:

```typescript
export async function getContactByEmail(email: string): Promise<CRMContact | null>
```

Uses Zoho CRM search API: `GET /crm/v6/Contacts/search?email={email}`

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/portal/page.tsx` | Dashboard (replace placeholder) |
| `app/portal/account/page.tsx` | Read-only account info |
| `app/portal/pending/page.tsx` | "Pending approval" page |
| `app/components/UserMenu.tsx` | User icon + dropdown menu |
| `app/api/portal/account/route.ts` | GET partner account info from Zoho |
| `app/api/portal/match/route.ts` | POST auto-match email to Zoho Contact |
| `lib/portal/types.ts` | Partner metadata types |
| `scripts/portal-invite.ts` | CLI invite script |

### Modified Files

| File | Change |
|------|--------|
| `lib/zoho/crm.ts` | Add `getContactByEmail()` function |
| `app/components/Navigation.tsx` | Add UserMenu for logged-in partners |
| `app/components/MobileMenu.tsx` | Add partner section for logged-in partners |
| `app/portal/layout.tsx` | Update auth check to trigger auto-matching |

---

## Dependencies

No new packages. Uses existing:
- `@clerk/nextjs` — auth, user metadata
- `googleapis` — Gmail API for invite emails
- `@heroicons/react` — UserCircleIcon
- `@upstash/ratelimit` — API rate limiting
- `zod` — validation

---

## Environment Variables

No new env vars. Uses existing Clerk, Zoho, Gmail credentials.

Clerk Backend API for metadata updates uses `CLERK_SECRET_KEY` (already configured).

---

## Testing

### Unit Tests
- `__tests__/lib/zoho/crm-email-lookup.test.ts` — `getContactByEmail` (found, not found, error)
- `__tests__/lib/portal/types.test.ts` — metadata type validation

### API Route Tests
- `__tests__/app/api/portal/account.test.ts` — auth required, returns contact data, 404 for missing contact
- `__tests__/app/api/portal/match.test.ts` — match found (updates metadata), no match, rate limiting

### Component Tests
- `__tests__/app/components/UserMenu.test.tsx` — renders menu items, disabled states, sign-out action

---

## Deferred

- Browse catalog with partner pricing (Phase 5b)
- Cart/quote builder (Phase 5c)
- Order history, favorites, reorder (Phase 5d)
- Admin page for partner approval (future — Ken uses Clerk dashboard + Zoho for now)
- Zoho webhooks for auto-sync (future)
