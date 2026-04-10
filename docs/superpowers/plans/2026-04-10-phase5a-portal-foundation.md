# Phase 5a: Partner Auth + Portal Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the partner auth flow (auto-matching via Zoho CRM), portal dashboard, account page, user menu in navigation, and invite script — so approved dealers can sign up and access the B2B portal.

**Architecture:** Clerk handles auth. On first portal visit, the system auto-matches the user's email to a Zoho CRM Contact and sets Clerk metadata (role, zohoContactId, company, priceListId). Navigation shows a user menu dropdown for logged-in partners. Dashboard is minimal with quick-action cards. Account page is read-only, pulling data from Zoho CRM.

**Tech Stack:** Next.js 16 App Router, Clerk (auth + metadata), Zoho CRM v6 API, Gmail API, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/portal/types.ts` | PartnerMetadata type + Zod schema |
| `lib/zoho/crm.ts` | Modified: add `getContactByEmail()` |
| `app/api/portal/match/route.ts` | POST: auto-match user email to Zoho CRM Contact |
| `app/api/portal/account/route.ts` | GET: fetch partner account info from Zoho CRM |
| `app/portal/layout.tsx` | Modified: trigger auto-matching instead of hard redirect |
| `app/portal/page.tsx` | Modified: dashboard with welcome + quick-action cards |
| `app/portal/pending/page.tsx` | "Pending approval" page for unmatched users |
| `app/portal/account/page.tsx` | Read-only account info from Zoho CRM |
| `app/components/UserMenu.tsx` | User icon + dropdown menu (client component) |
| `app/components/Navigation.tsx` | Modified: add UserMenu for partners, hide Login link |
| `app/components/MobileMenu.tsx` | Modified: add partner section |
| `scripts/portal-invite.ts` | CLI script to send invite email |

---

### Task 1: Partner Metadata Types

**Files:**
- Create: `lib/portal/types.ts`
- Test: `__tests__/lib/portal/types.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/portal/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { partnerMetadataSchema } from "@/lib/portal/types";

describe("partnerMetadataSchema", () => {
  it("validates complete partner metadata", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
      company: "Brilliant Eye Care",
      priceListId: "67890",
    });
    expect(result.success).toBe(true);
  });

  it("validates without optional priceListId", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
      company: "Brilliant Eye Care",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-partner role", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "admin",
      zohoContactId: "12345",
      company: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing zohoContactId", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      company: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing company", () => {
    const result = partnerMetadataSchema.safeParse({
      role: "partner",
      zohoContactId: "12345",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/portal/types.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types**

Create `lib/portal/types.ts`:

```typescript
import { z } from "zod";

export const partnerMetadataSchema = z.object({
  role: z.literal("partner"),
  zohoContactId: z.string().min(1),
  company: z.string().min(1),
  priceListId: z.string().optional(),
});

export type PartnerMetadata = z.infer<typeof partnerMetadataSchema>;

export function isPartner(metadata: unknown): metadata is PartnerMetadata {
  return partnerMetadataSchema.safeParse(metadata).success;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/portal/types.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/portal/types.ts __tests__/lib/portal/types.test.ts
git commit -m "feat: add partner metadata types and validation"
```

---

### Task 2: Zoho CRM Email Lookup

**Files:**
- Modify: `lib/zoho/crm.ts`
- Test: `__tests__/lib/zoho/crm-email-lookup.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/zoho/crm-email-lookup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({
  mockZohoFetch: vi.fn(),
}));

vi.mock("@/lib/zoho/client", () => ({
  zohoFetch: mockZohoFetch,
}));

vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ZOHO_API_BASE_URL: "https://www.zohoapis.com",
    ZOHO_ORG_ID: "test-org",
  },
}));

import { getContactByEmail, type CRMContact } from "@/lib/zoho/crm";

describe("getContactByEmail", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("returns contact when found by email", async () => {
    const contact: CRMContact = {
      id: "c1",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
      Account_Name: "Best Eye Care",
      Phone: "555-1234",
      Mailing_Street: "123 Main St",
      Mailing_City: "Chicago",
      Mailing_State: "IL",
      Mailing_Zip: "60601",
    };

    mockZohoFetch.mockResolvedValueOnce({ data: [contact] });

    const result = await getContactByEmail("dealer@store.com");

    expect(result).toEqual(contact);
    expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Contacts/search", {
      params: { email: "dealer@store.com" },
    });
  });

  it("returns null when no contact matches", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: null });

    const result = await getContactByEmail("unknown@store.com");

    expect(result).toBeNull();
  });

  it("returns null when data is empty array", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: [] });

    const result = await getContactByEmail("unknown@store.com");

    expect(result).toBeNull();
  });

  it("rejects invalid email format", async () => {
    await expect(getContactByEmail("not-an-email")).rejects.toThrow("Invalid email");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/zoho/crm-email-lookup.test.ts`
Expected: FAIL — `getContactByEmail` not found

- [ ] **Step 3: Implement getContactByEmail**

Add to `lib/zoho/crm.ts` after the `getContactById` function:

```typescript
export async function getContactByEmail(
  email: string,
): Promise<CRMContact | null> {
  if (!email.includes("@")) {
    throw new Error("Invalid email");
  }

  const response = await zohoFetch<ContactsResponse>(
    "/crm/v6/Contacts/search",
    { params: { email } },
  );

  const contact = response.data?.[0];
  return contact ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/zoho/crm-email-lookup.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zoho/crm.ts __tests__/lib/zoho/crm-email-lookup.test.ts
git commit -m "feat: add getContactByEmail to Zoho CRM"
```

---

### Task 3: POST /api/portal/match Route

**Files:**
- Create: `app/api/portal/match/route.ts`
- Test: `__tests__/app/api/portal/match.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/portal/match.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetContactByEmail } = vi.hoisted(() => ({ mockGetContactByEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));
const { mockClerkClient } = vi.hoisted(() => ({
  mockClerkClient: { users: { updateUserMetadata: vi.fn() } },
}));

vi.mock("@/lib/zoho/crm", () => ({ getContactByEmail: mockGetContactByEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mockCurrentUser,
  clerkClient: vi.fn().mockResolvedValue(mockClerkClient),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/portal/match/route";

describe("POST /api/portal/match", () => {
  beforeEach(() => {
    mockGetContactByEmail.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
    mockClerkClient.users.updateUserMetadata.mockReset().mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("matches user email to Zoho contact and updates metadata", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      emailAddresses: [{ emailAddress: "dealer@store.com" }],
      publicMetadata: {},
    });
    mockGetContactByEmail.mockResolvedValue({
      id: "zoho-123",
      Account_Name: "Best Eye Care",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
    });

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.matched).toBe(true);
    expect(data.company).toBe("Best Eye Care");
    expect(mockClerkClient.users.updateUserMetadata).toHaveBeenCalledWith("user-1", {
      publicMetadata: {
        role: "partner",
        zohoContactId: "zoho-123",
        company: "Best Eye Care",
      },
    });
  });

  it("returns matched: false when no Zoho contact found", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-2",
      emailAddresses: [{ emailAddress: "nobody@store.com" }],
      publicMetadata: {},
    });
    mockGetContactByEmail.mockResolvedValue(null);

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.matched).toBe(false);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "user-3",
      emailAddresses: [{ emailAddress: "test@store.com" }],
      publicMetadata: {},
    });

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/api/portal/match.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement match route**

Create `app/api/portal/match/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getContactByEmail } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ matched: false });
  }

  const contact = await getContactByEmail(email);
  if (!contact) {
    return NextResponse.json({ matched: false });
  }

  const metadata: Record<string, string> = {
    role: "partner",
    zohoContactId: contact.id,
    company: contact.Account_Name,
  };

  const client = await clerkClient();
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: metadata,
  });

  return NextResponse.json({ matched: true, company: contact.Account_Name });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/api/portal/match.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/portal/match/route.ts __tests__/app/api/portal/match.test.ts
git commit -m "feat: add POST /api/portal/match for auto-matching"
```

---

### Task 4: GET /api/portal/account Route

**Files:**
- Create: `app/api/portal/account/route.ts`
- Test: `__tests__/app/api/portal/account.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/portal/account.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetContactById } = vi.hoisted(() => ({ mockGetContactById: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/crm", () => ({ getContactById: mockGetContactById }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { GET } from "@/app/api/portal/account/route";

describe("GET /api/portal/account", () => {
  beforeEach(() => {
    mockGetContactById.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {},
    });
    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns account info for valid partner", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {
        role: "partner",
        zohoContactId: "zoho-123",
        company: "Best Eye Care",
      },
    });
    mockGetContactById.mockResolvedValue({
      id: "zoho-123",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
      Account_Name: "Best Eye Care",
      Phone: "555-1234",
      Mailing_Street: "123 Main St",
      Mailing_City: "Chicago",
      Mailing_State: "IL",
      Mailing_Zip: "60601",
    });

    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.company).toBe("Best Eye Care");
    expect(data.firstName).toBe("John");
    expect(data.lastName).toBe("Doe");
    expect(data.email).toBe("dealer@store.com");
    expect(data.phone).toBe("555-1234");
    expect(data.address.street).toBe("123 Main St");
  });

  it("returns 404 when Zoho contact not found", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {
        role: "partner",
        zohoContactId: "missing",
        company: "Test",
      },
    });
    mockGetContactById.mockRejectedValue(new Error("CRM contact not found: missing"));

    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/api/portal/account.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement account route**

Create `app/api/portal/account/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { getContactById } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";

export async function GET(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isPartner(user.publicMetadata)) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  const { zohoContactId, priceListId } = user.publicMetadata;

  try {
    const contact = await getContactById(zohoContactId);
    return NextResponse.json({
      company: contact.Account_Name,
      firstName: contact.First_Name,
      lastName: contact.Last_Name,
      email: contact.Email,
      phone: contact.Phone,
      address: {
        street: contact.Mailing_Street,
        city: contact.Mailing_City,
        state: contact.Mailing_State,
        zip: contact.Mailing_Zip,
      },
      pricingTier: priceListId ? "Custom" : "Standard",
    });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/api/portal/account.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/portal/account/route.ts __tests__/app/api/portal/account.test.ts
git commit -m "feat: add GET /api/portal/account endpoint"
```

---

### Task 5: Portal Layout with Auto-Matching

**Files:**
- Modify: `app/portal/layout.tsx`
- Create: `app/portal/pending/page.tsx`

- [ ] **Step 1: Update portal layout to trigger auto-matching**

Replace `app/portal/layout.tsx`:

```tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isPartner } from "@/lib/portal/types";
import { getContactByEmail } from "@/lib/zoho/crm";
import { clerkClient } from "@clerk/nextjs/server";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Already a partner — proceed
  if (isPartner(user.publicMetadata)) {
    return <>{children}</>;
  }

  // Not yet matched — try auto-matching
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) {
    const contact = await getContactByEmail(email);
    if (contact) {
      const client = await clerkClient();
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          role: "partner",
          zohoContactId: contact.id,
          company: contact.Account_Name,
        },
      });
      // Refresh page to pick up new metadata
      redirect("/portal");
    }
  }

  // No match — show pending page
  redirect("/portal/pending");
}
```

- [ ] **Step 2: Create pending approval page**

Create `app/portal/pending/page.tsx`:

```tsx
import Link from "next/link";

export const metadata = {
  title: "Account Pending | LOUISLUSO",
};

export default function PendingPage(): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl text-white">Account Pending</h1>
        <p className="mt-4 text-sm text-gray-400">
          Your partner application is being reviewed. We&apos;ll be in touch soon.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Questions? Contact{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify pending page is outside portal layout auth check**

The pending page lives at `/portal/pending` which goes through `portal/layout.tsx`. Since the layout redirects unmatched users to `/portal/pending`, this would cause an infinite redirect. Fix: the pending page needs its own route group.

Move pending outside the layout by creating `app/(portal-pending)/portal/pending/page.tsx` — or simpler: adjust the layout to allow the pending path through:

Update `app/portal/layout.tsx` — check if we're already on the pending page:

```tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isPartner } from "@/lib/portal/types";
import { getContactByEmail } from "@/lib/zoho/crm";
import { clerkClient } from "@clerk/nextjs/server";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const headerList = await headers();
  const url = headerList.get("x-url") ?? headerList.get("x-invoke-path") ?? "";
  const isPendingPage = url.includes("/portal/pending");

  // Already a partner — proceed
  if (isPartner(user.publicMetadata)) {
    return <>{children}</>;
  }

  // On the pending page already — just render it
  if (isPendingPage) {
    return <>{children}</>;
  }

  // Not yet matched — try auto-matching
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) {
    const contact = await getContactByEmail(email);
    if (contact) {
      const client = await clerkClient();
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          role: "partner",
          zohoContactId: contact.id,
          company: contact.Account_Name,
        },
      });
      redirect("/portal");
    }
  }

  // No match — show pending page
  redirect("/portal/pending");
}
```

Note: The `x-url` / `x-invoke-path` headers may not be reliable across all environments. A more robust approach is to use Next.js route groups. Create the pending page outside the portal layout:

Create directory structure: `app/portal-pending/page.tsx` and update redirect to `/portal-pending`. But this changes the URL. Alternatively, use `next/navigation`'s `usePathname` — but that's client-side only.

The simplest reliable approach: make the pending page a standalone route at `/pending-approval`:

Create `app/pending-approval/page.tsx` (same content as above), and update the layout redirect to `/pending-approval`.

- [ ] **Step 4: Commit**

```bash
git add app/portal/layout.tsx app/pending-approval/page.tsx
git commit -m "feat: add auto-matching portal layout and pending page"
```

---

### Task 6: Portal Dashboard

**Files:**
- Modify: `app/portal/page.tsx`

- [ ] **Step 1: Replace placeholder dashboard**

Replace `app/portal/page.tsx`:

```tsx
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import type { PartnerMetadata } from "@/lib/portal/types";

export const metadata = {
  title: "Partner Dashboard | LOUISLUSO",
};

export default async function PortalDashboard(): Promise<React.ReactElement> {
  const user = await currentUser();
  const meta = user?.publicMetadata as PartnerMetadata;
  const firstName = user?.firstName ?? "Partner";

  const cards = [
    {
      title: "Browse Catalog",
      description: "View our collections with your pricing",
      href: "/eyeglasses",
      enabled: true,
    },
    {
      title: "View Orders",
      description: "Coming soon",
      href: "/portal/orders",
      enabled: false,
    },
    {
      title: "Account Settings",
      description: "View your account details",
      href: "/portal/account",
      enabled: true,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-bronze">{meta.company}</p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.enabled ? card.href : "#"}
              className={`rounded-lg border px-6 py-5 transition-colors ${
                card.enabled
                  ? "border-white/10 bg-white/[0.02] hover:border-bronze/30 hover:bg-white/[0.04]"
                  : "pointer-events-none border-white/5 bg-white/[0.01] opacity-50"
              }`}
            >
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/portal/page.tsx
git commit -m "feat: add portal dashboard with quick-action cards"
```

---

### Task 7: Portal Account Page

**Files:**
- Create: `app/portal/account/page.tsx`

- [ ] **Step 1: Create account page**

Create `app/portal/account/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface AccountInfo {
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  pricingTier: string;
}

export default function AccountPage(): React.ReactElement {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchAccount(): Promise<void> {
      try {
        const res = await fetch("/api/portal/account");
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setAccount(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">Loading account...</p>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-400">Unable to load account info.</p>
      </main>
    );
  }

  const fields = [
    { label: "Company", value: account.company },
    { label: "Contact", value: `${account.firstName} ${account.lastName}` },
    { label: "Email", value: account.email },
    { label: "Phone", value: account.phone },
    {
      label: "Address",
      value: [
        account.address.street,
        `${account.address.city}, ${account.address.state} ${account.address.zip}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    { label: "Pricing Tier", value: account.pricingTier },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl text-white">Account</h1>
        <p className="mt-1 text-sm text-gray-500">Your partner account details</p>

        <div className="mt-10 space-y-6">
          {fields.map((field) => (
            <div key={field.label} className="border-b border-white/10 pb-4">
              <dt className="text-[11px] font-medium uppercase tracking-[2px] text-gray-500">
                {field.label}
              </dt>
              <dd className="mt-1.5 whitespace-pre-line text-sm text-gray-200">
                {field.value || "—"}
              </dd>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-600">
          Need to update your information? Contact{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/portal/account/page.tsx
git commit -m "feat: add read-only portal account page"
```

---

### Task 8: UserMenu Component

**Files:**
- Create: `app/components/UserMenu.tsx`
- Test: `__tests__/app/components/UserMenu.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/UserMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/app/components/UserMenu";

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));

describe("UserMenu", () => {
  it("renders user icon button", () => {
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: /account menu/i })).toBeDefined();
  });

  it("shows dropdown on click", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Account")).toBeDefined();
    expect(screen.getByText("Sign Out")).toBeDefined();
  });

  it("shows coming soon items as disabled", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    const ordersLink = screen.getByText(/orders/i);
    expect(ordersLink.closest("span")?.className).toContain("text-gray-600");
  });

  it("closes dropdown when clicking outside", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Dashboard")).toBeDefined();
    await userEvent.click(document.body);
    expect(screen.queryByText("Dashboard")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/components/UserMenu.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement UserMenu**

Create `app/components/UserMenu.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { UserCircleIcon } from "@heroicons/react/24/outline";

const MENU_ITEMS = [
  { label: "Dashboard", href: "/portal", enabled: true },
  { label: "Orders", href: "/portal/orders", enabled: false },
  { label: "Favorites", href: "/portal/favorites", enabled: false },
  { label: "Account", href: "/portal/account", enabled: true },
];

export function UserMenu(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="text-gray-500 transition-colors hover:text-bronze"
      >
        <UserCircleIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
          {MENU_ITEMS.map((item) =>
            item.enabled ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-xs text-gray-300 transition-colors hover:bg-white/[0.04] hover:text-bronze"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="block px-4 py-2 text-xs text-gray-600"
              >
                {item.label} <span className="text-gray-700">(Coming soon)</span>
              </span>
            ),
          )}

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={() => signOut()}
            className="block w-full px-4 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-red-400"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/components/UserMenu.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/UserMenu.tsx __tests__/app/components/UserMenu.test.tsx
git commit -m "feat: add UserMenu dropdown component"
```

---

### Task 9: Navigation Integration

**Files:**
- Modify: `app/components/Navigation.tsx`
- Modify: `app/components/MobileMenu.tsx`

- [ ] **Step 1: Update Navigation to show UserMenu for partners**

The Navigation component is a server component. We need to check auth status and conditionally render UserMenu (client) or Login link.

Edit `app/components/Navigation.tsx`:

Add imports at top:
```tsx
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { UserMenu } from "./UserMenu";
```

Make the component async and check auth:
```tsx
export async function Navigation(): Promise<React.ReactElement> {
  const user = await currentUser();
  const partner = user ? isPartner(user.publicMetadata) : false;
```

Replace the right nav section — swap Login link for UserMenu when partner:
```tsx
{/* Right: utility links (desktop) */}
<div className="hidden items-center gap-6 lg:flex">
  <Link href="/find-a-dealer" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Find a Dealer</Link>
  <Link href="/portal" aria-label="Favorites"><HeartIcon className="h-5 w-5 text-gray-500 transition-colors hover:text-bronze" /></Link>
  {partner ? (
    <UserMenu />
  ) : (
    <Link href="/portal" className="text-xs font-medium uppercase tracking-[1.5px] text-gray-700 transition-colors hover:text-bronze">Login</Link>
  )}
</div>
```

- [ ] **Step 2: Update MobileMenu to accept partner prop**

Edit `app/components/MobileMenu.tsx`:

Add `isPartner` prop to interface:
```tsx
interface MobileMenuProps {
  eyeglassesCollections: Collection[];
  sunglassesCollections: Collection[];
  isPartner?: boolean;
}
```

Add partner section before the closing `</nav>`:
```tsx
{isPartner && (
  <div className="border-t border-gray-200 pt-4">
    <p className="mb-2 text-[10px] font-medium uppercase tracking-[2px] text-gray-400">Partner</p>
    <Link href="/portal" onClick={() => setOpen(false)} className="block text-sm text-gray-500 hover:text-bronze">
      Dashboard
    </Link>
    <Link href="/portal/account" onClick={() => setOpen(false)} className="mt-2 block text-sm text-gray-500 hover:text-bronze">
      Account
    </Link>
  </div>
)}
```

Update Navigation.tsx to pass `isPartner` to MobileMenu:
```tsx
<MobileMenu eyeglassesCollections={eyeglasses} sunglassesCollections={sunglasses} isPartner={partner} />
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Navigation.tsx app/components/MobileMenu.tsx
git commit -m "feat: add UserMenu to nav for logged-in partners"
```

---

### Task 10: Invite Script

**Files:**
- Create: `scripts/portal-invite.ts`

- [ ] **Step 1: Create invite script**

Create `scripts/portal-invite.ts`:

```typescript
import "dotenv/config";
import { readFileSync } from "fs";

// --- Security: verify .env is gitignored ---
function verifyGitignore(): void {
  try {
    const gitignore = readFileSync(".gitignore", "utf-8");
    if (!gitignore.split("\n").some((line) => line.trim() === ".env")) {
      console.error("ABORT: .env is not listed in .gitignore.");
      process.exit(1);
    }
  } catch {
    console.error("ABORT: No .gitignore found.");
    process.exit(1);
  }
}

verifyGitignore();

// Use the email/ gmail client since it has the OAuth tokens
import { getSheetsClient as _, getGmailClient, sendRawEmail } from "../email/gmail.ts";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let email = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--email":
        email = args[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
    }
  }

  if (!email || !email.includes("@")) {
    console.error("Usage: pnpm portal:invite --email dealer@store.com [--dry-run]");
    process.exit(1);
  }

  console.log(`Looking up ${email} in Zoho CRM...`);

  // Dynamic import to use the Zoho env
  const { env } = await import("../lib/env.ts");
  const { getContactByEmail } = await import("../lib/zoho/crm.ts");

  const contact = await getContactByEmail(email);
  if (!contact) {
    console.error(`No Zoho CRM Contact found for ${email}`);
    process.exit(1);
  }

  const firstName = contact.First_Name || "Partner";
  const company = contact.Account_Name || "";

  console.log(`Found: ${firstName} ${contact.Last_Name} — ${company}`);

  const signupUrl = "https://louisluso.com/sign-up";

  const subject = "Welcome to the LOUISLUSO Partner Portal";
  const body = [
    `Hi ${firstName},`,
    "",
    "Great news — your LOUISLUSO partner application has been approved!",
    "",
    `You can now access wholesale pricing and place orders through our Partner Portal.`,
    "",
    `To get started, create your account using this email address (${email}):`,
    "",
    signupUrl,
    "",
    "Once you've created your account, you'll have access to:",
    "  - Wholesale pricing on all collections",
    "  - Online ordering (coming soon)",
    "  - Order history and tracking (coming soon)",
    "",
    "If you have any questions, reply to this email or contact us at cs@louisluso.com.",
    "",
    "Welcome aboard!",
    "",
    "— The LOUISLUSO Team",
    "https://louisluso.com",
  ].join("\n");

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`\n${body}`);
    console.log("--- END DRY RUN ---\n");
    return;
  }

  // Use the existing sendEmail from lib/gmail.ts
  const { sendEmail } = await import("../lib/gmail.ts");
  await sendEmail({ to: email, subject, body });

  console.log(`Invite sent to ${email}`);
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to package.json**

Add to `package.json` scripts:
```json
"portal:invite": "tsx scripts/portal-invite.ts"
```

- [ ] **Step 3: Test dry run**

Run: `pnpm portal:invite -- --email cs@louisluso.com --dry-run`
Expected: Prints the email content without sending

- [ ] **Step 4: Commit**

```bash
git add scripts/portal-invite.ts package.json
git commit -m "feat: add portal invite script"
```

---

### Task 11: Full Test Suite + Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds, `/portal`, `/portal/account`, `/pending-approval` pages included

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address Phase 5a build/test issues"
```
