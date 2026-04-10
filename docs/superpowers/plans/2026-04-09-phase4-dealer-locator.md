# Phase 4: Dealer Locator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/find-a-dealer` page with a dark Mapbox map, sidebar dealer list, and "Contact This Dealer" modal — using mock data for now, backend integration later.

**Architecture:** Client-heavy page with a Mapbox GL map component, dealer list sidebar, and modal contact form. Mock dealer data served via API route. Contact form emails via existing Gmail API with added BCC support. Distance calculations done client-side using the Haversine formula.

**Tech Stack:** Next.js 16 App Router, Mapbox GL JS, Zod, Gmail API, Upstash rate limiting, Vitest + React Testing Library

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/dealers/types.ts` | `Dealer` and `ContactDealerInput` type definitions |
| `lib/dealers/mock-data.ts` | ~10 hardcoded mock dealers (Chicago area) with coordinates |
| `lib/dealers/distance.ts` | Haversine distance calculation + dealer sorting/filtering by radius |
| `lib/schemas/contact-dealer.ts` | Zod schema for contact dealer form |
| `app/api/dealers/route.ts` | GET endpoint returning mock dealers |
| `app/api/dealers/[id]/contact/route.ts` | POST endpoint for contacting a dealer via email |
| `app/find-a-dealer/page.tsx` | Page component (server wrapper) |
| `app/find-a-dealer/FindADealerClient.tsx` | Client component orchestrating map + list + modal state |
| `app/components/DealerMap.tsx` | Mapbox GL map with pins (`"use client"`) |
| `app/components/DealerCard.tsx` | Individual dealer card with Call/Directions/Contact buttons |
| `app/components/ContactDealerModal.tsx` | Modal with contact form |
| `lib/gmail.ts` | Modified: add optional `bcc` parameter |
| `lib/env.ts` | Modified: add `NEXT_PUBLIC_MAPBOX_TOKEN` |

---

### Task 1: Dealer Types and Mock Data

**Files:**
- Create: `lib/dealers/types.ts`
- Create: `lib/dealers/mock-data.ts`
- Test: `__tests__/lib/dealers/mock-data.test.ts`

- [ ] **Step 1: Create dealer type definitions**

Create `lib/dealers/types.ts`:

```typescript
export interface DealerAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface DealerCoordinates {
  lat: number;
  lng: number;
}

export interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: DealerAddress;
  coordinates: DealerCoordinates;
}

export interface ContactDealerInput {
  customerName: string;
  customerEmail: string;
  message?: string;
  productSlug?: string;
}
```

- [ ] **Step 2: Create mock dealer data**

Create `lib/dealers/mock-data.ts` with ~10 dealers in the Chicago/Illinois area. Use realistic names, addresses, phone numbers, and real lat/lng coordinates:

```typescript
import type { Dealer } from "./types";

export const MOCK_DEALERS: Dealer[] = [
  {
    id: "dealer-001",
    name: "Brilliant Eye Care",
    email: "info@brillianteye.example.com",
    phone: "(847) 555-0123",
    address: {
      street: "123 E Main St",
      city: "Arlington Heights",
      state: "IL",
      zip: "60004",
    },
    coordinates: { lat: 42.0884, lng: -87.9806 },
  },
  {
    id: "dealer-002",
    name: "Vision Plus Optical",
    email: "contact@visionplus.example.com",
    phone: "(847) 555-0456",
    address: {
      street: "456 Schaumburg Rd",
      city: "Schaumburg",
      state: "IL",
      zip: "60193",
    },
    coordinates: { lat: 42.0334, lng: -88.0834 },
  },
  {
    id: "dealer-003",
    name: "Midwest Eyewear Center",
    email: "hello@midwesteyewear.example.com",
    phone: "(847) 555-0789",
    address: {
      street: "789 Miner St",
      city: "Des Plaines",
      state: "IL",
      zip: "60016",
    },
    coordinates: { lat: 42.0334, lng: -87.8834 },
  },
  {
    id: "dealer-004",
    name: "LensCraft Pro",
    email: "sales@lenscraftpro.example.com",
    phone: "(847) 555-1011",
    address: {
      street: "1011 N Northwest Hwy",
      city: "Palatine",
      state: "IL",
      zip: "60067",
    },
    coordinates: { lat: 42.1103, lng: -88.0340 },
  },
  {
    id: "dealer-005",
    name: "Crystal Clear Vision",
    email: "info@crystalclear.example.com",
    phone: "(312) 555-2020",
    address: {
      street: "200 N Michigan Ave",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    },
    coordinates: { lat: 41.8860, lng: -87.6246 },
  },
  {
    id: "dealer-006",
    name: "North Shore Eye Associates",
    email: "office@northshoreeye.example.com",
    phone: "(847) 555-3030",
    address: {
      street: "303 Green Bay Rd",
      city: "Evanston",
      state: "IL",
      zip: "60201",
    },
    coordinates: { lat: 42.0451, lng: -87.6878 },
  },
  {
    id: "dealer-007",
    name: "Prairie View Optical",
    email: "hello@prairieview.example.com",
    phone: "(630) 555-4040",
    address: {
      street: "404 Ogden Ave",
      city: "Naperville",
      state: "IL",
      zip: "60540",
    },
    coordinates: { lat: 41.7508, lng: -88.1535 },
  },
  {
    id: "dealer-008",
    name: "Oakbrook Eye Specialists",
    email: "info@oakbrookeye.example.com",
    phone: "(630) 555-5050",
    address: {
      street: "505 Oak Brook Center",
      city: "Oak Brook",
      state: "IL",
      zip: "60523",
    },
    coordinates: { lat: 41.8500, lng: -87.9500 },
  },
  {
    id: "dealer-009",
    name: "Wicker Park Eyecare",
    email: "hello@wpeyecare.example.com",
    phone: "(773) 555-6060",
    address: {
      street: "1606 N Milwaukee Ave",
      city: "Chicago",
      state: "IL",
      zip: "60622",
    },
    coordinates: { lat: 41.9088, lng: -87.6748 },
  },
  {
    id: "dealer-010",
    name: "Fox Valley Vision Center",
    email: "info@foxvalleyvision.example.com",
    phone: "(630) 555-7070",
    address: {
      street: "707 S Randall Rd",
      city: "St. Charles",
      state: "IL",
      zip: "60174",
    },
    coordinates: { lat: 41.9200, lng: -88.3087 },
  },
];
```

- [ ] **Step 3: Write test for mock data integrity**

Create `__tests__/lib/dealers/mock-data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

describe("MOCK_DEALERS", () => {
  it("contains at least 10 dealers", () => {
    expect(MOCK_DEALERS.length).toBeGreaterThanOrEqual(10);
  });

  it("every dealer has all required fields", () => {
    for (const dealer of MOCK_DEALERS) {
      expect(dealer.id).toBeTruthy();
      expect(dealer.name).toBeTruthy();
      expect(dealer.email).toContain("@");
      expect(dealer.phone).toBeTruthy();
      expect(dealer.address.street).toBeTruthy();
      expect(dealer.address.city).toBeTruthy();
      expect(dealer.address.state).toHaveLength(2);
      expect(dealer.address.zip).toMatch(/^\d{5}$/);
      expect(dealer.coordinates.lat).toBeGreaterThan(0);
      expect(dealer.coordinates.lng).toBeLessThan(0);
    }
  });

  it("every dealer has a unique id", () => {
    const ids = MOCK_DEALERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- __tests__/lib/dealers/mock-data.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/dealers/types.ts lib/dealers/mock-data.ts __tests__/lib/dealers/mock-data.test.ts
git commit -m "feat: add dealer types and mock data"
```

---

### Task 2: Distance Calculation Utility

**Files:**
- Create: `lib/dealers/distance.ts`
- Test: `__tests__/lib/dealers/distance.test.ts`

- [ ] **Step 1: Write failing tests for distance utility**

Create `__tests__/lib/dealers/distance.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { haversineDistance, sortDealersByDistance, filterDealersByRadius } from "@/lib/dealers/distance";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    const dist = haversineDistance(42.0, -87.0, 42.0, -87.0);
    expect(dist).toBe(0);
  });

  it("calculates distance between Arlington Heights and Chicago (~22 miles)", () => {
    const dist = haversineDistance(42.0884, -87.9806, 41.8860, -87.6246);
    expect(dist).toBeGreaterThan(18);
    expect(dist).toBeLessThan(26);
  });
});

describe("sortDealersByDistance", () => {
  it("sorts dealers nearest first", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    expect(sorted[0].dealer.id).toBe("dealer-001");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].distance).toBeGreaterThanOrEqual(sorted[i - 1].distance);
    }
  });
});

describe("filterDealersByRadius", () => {
  it("filters to dealers within 10 miles of Arlington Heights", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    const nearby = filterDealersByRadius(sorted, 10);
    for (const entry of nearby) {
      expect(entry.distance).toBeLessThanOrEqual(10);
    }
  });

  it("returns all dealers when radius is null", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    const all = filterDealersByRadius(sorted, null);
    expect(all.length).toBe(MOCK_DEALERS.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/dealers/distance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement distance utility**

Create `lib/dealers/distance.ts`:

```typescript
import type { Dealer } from "./types";

export interface DealerWithDistance {
  dealer: Dealer;
  distance: number; // miles
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_MILES * c * 10) / 10;
}

export function sortDealersByDistance(
  dealers: Dealer[],
  userLat: number,
  userLng: number,
): DealerWithDistance[] {
  return dealers
    .map((dealer) => ({
      dealer,
      distance: haversineDistance(
        userLat,
        userLng,
        dealer.coordinates.lat,
        dealer.coordinates.lng,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
}

export function filterDealersByRadius(
  sorted: DealerWithDistance[],
  radiusMiles: number | null,
): DealerWithDistance[] {
  if (radiusMiles === null) return sorted;
  return sorted.filter((entry) => entry.distance <= radiusMiles);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/dealers/distance.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/dealers/distance.ts __tests__/lib/dealers/distance.test.ts
git commit -m "feat: add haversine distance calculation and dealer filtering"
```

---

### Task 3: Contact Dealer Zod Schema

**Files:**
- Create: `lib/schemas/contact-dealer.ts`
- Test: `__tests__/lib/schemas/contact-dealer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/schemas/contact-dealer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { contactDealerSchema } from "@/lib/schemas/contact-dealer";

describe("contactDealerSchema", () => {
  it("validates a complete contact form", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John Smith",
      customerEmail: "john@example.com",
      message: "I'm interested in trying on the SP1018.",
      productSlug: "sp1018",
    });
    expect(result.success).toBe(true);
  });

  it("validates without optional fields", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing customerName", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "",
      customerEmail: "john@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message over 1000 characters", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      message: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts message at exactly 1000 characters", () => {
    const result = contactDealerSchema.safeParse({
      customerName: "John",
      customerEmail: "john@example.com",
      message: "a".repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/lib/schemas/contact-dealer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

Create `lib/schemas/contact-dealer.ts`:

```typescript
import { z } from "zod";

export const contactDealerSchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100),
  customerEmail: z.string().email("Valid email required"),
  message: z.string().max(1000, "Message must be under 1000 characters").optional(),
  productSlug: z.string().max(100).optional(),
});

export type ContactDealerFormData = z.infer<typeof contactDealerSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/schemas/contact-dealer.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/contact-dealer.ts __tests__/lib/schemas/contact-dealer.test.ts
git commit -m "feat: add contact dealer Zod schema"
```

---

### Task 4: Add BCC Support to Gmail Utility

**Files:**
- Modify: `lib/gmail.ts`
- Test: `__tests__/lib/gmail.test.ts`

- [ ] **Step 1: Write failing test for BCC**

Create `__tests__/lib/gmail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn().mockResolvedValue({});
vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: vi.fn().mockImplementation(() => ({ setCredentials: vi.fn() })) },
    gmail: vi.fn().mockReturnValue({
      users: { messages: { send: mockSend } },
    }),
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    GMAIL_CLIENT_ID: "test-id",
    GMAIL_CLIENT_SECRET: "test-secret",
    GMAIL_REFRESH_TOKEN: "test-token",
  },
}));

import { sendEmail } from "@/lib/gmail";

describe("sendEmail", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("sends an email with basic fields", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello" });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("To: dealer@example.com");
    expect(decoded).toContain("Subject: Test");
    expect(decoded).toContain("Hello");
  });

  it("includes Reply-To header when provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", replyTo: "customer@example.com" });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Reply-To: customer@example.com");
  });

  it("includes BCC header when provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", bcc: ["admin@louisluso.com"] });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Bcc: admin@louisluso.com");
  });

  it("supports multiple BCC recipients", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", bcc: ["admin@louisluso.com", "ken@louisluso.com"] });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Bcc: admin@louisluso.com, ken@louisluso.com");
  });

  it("omits BCC header when not provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello" });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).not.toContain("Bcc:");
  });
});
```

- [ ] **Step 2: Run tests to verify BCC tests fail**

Run: `pnpm test -- __tests__/lib/gmail.test.ts`
Expected: BCC-related tests FAIL (no `bcc` property on `SendEmailOptions`)

- [ ] **Step 3: Add BCC support to sendEmail**

Edit `lib/gmail.ts` — add `bcc?: string[]` to `SendEmailOptions` and include the header:

```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  bcc?: string[];
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const gmail = getGmailClient();

  const headers = [
    `To: ${options.to}`,
    `From: cs@louisluso.com`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`);
  }

  if (options.bcc && options.bcc.length > 0) {
    headers.push(`Bcc: ${options.bcc.join(", ")}`);
  }

  const message = [...headers, "", options.body].join("\r\n");
  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/lib/gmail.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/gmail.ts __tests__/lib/gmail.test.ts
git commit -m "feat: add BCC support to sendEmail utility"
```

---

### Task 5: GET Dealers API Route

**Files:**
- Create: `app/api/dealers/route.ts`
- Test: `__tests__/app/api/dealers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/dealers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/dealers/route";

describe("GET /api/dealers", () => {
  it("returns all mock dealers", async () => {
    const request = new Request("http://localhost/api/dealers");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dealers).toBeDefined();
    expect(data.dealers.length).toBeGreaterThanOrEqual(10);
  });

  it("each dealer has required fields", async () => {
    const request = new Request("http://localhost/api/dealers");
    const response = await GET(request);
    const data = await response.json();
    for (const dealer of data.dealers) {
      expect(dealer.id).toBeTruthy();
      expect(dealer.name).toBeTruthy();
      expect(dealer.coordinates.lat).toBeDefined();
      expect(dealer.coordinates.lng).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/api/dealers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GET route**

Create `app/api/dealers/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ dealers: MOCK_DEALERS });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/api/dealers.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/dealers/route.ts __tests__/app/api/dealers.test.ts
git commit -m "feat: add GET /api/dealers endpoint"
```

---

### Task 6: POST Contact Dealer API Route

**Files:**
- Create: `app/api/dealers/[id]/contact/route.ts`
- Test: `__tests__/app/api/dealers-contact.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/api/dealers-contact.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/dealers/[id]/contact/route";

function makeRequest(dealerId: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/dealers/${dealerId}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dealers/[id]/contact", () => {
  beforeEach(() => {
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
  });

  it("sends email to dealer with valid data", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "John Smith",
      customerEmail: "john@example.com",
      message: "Interested in SP1018",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("info@brillianteye.example.com");
    expect(call.replyTo).toBe("john@example.com");
    expect(call.bcc).toContain("admin@louisluso.com");
    expect(call.body).toContain("John Smith");
  });

  it("returns 400 for invalid data", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "",
      customerEmail: "bad-email",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown dealer", async () => {
    const request = makeRequest("dealer-999", {
      customerName: "John",
      customerEmail: "john@example.com",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-999" }) });
    expect(response.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    const request = makeRequest("dealer-001", {
      customerName: "John",
      customerEmail: "john@example.com",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(429);
  });

  it("includes product info in email when productSlug provided", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "John Smith",
      customerEmail: "john@example.com",
      productSlug: "sp1018",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(200);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.body).toContain("sp1018");
    expect(call.body).toContain("louisluso.com/products/sp1018");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/api/dealers-contact.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement POST route**

Create `app/api/dealers/[id]/contact/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { contactDealerSchema } from "@/lib/schemas/contact-dealer";
import { sendEmail } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  const dealer = MOCK_DEALERS.find((d) => d.id === id);
  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = contactDealerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { customerName, customerEmail, message, productSlug } = parsed.data;

  const emailLines = [
    `A customer found your store on louisluso.com and would like to connect.`,
    "",
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
  ];

  if (message) {
    emailLines.push("", "Message:", message);
  }

  if (productSlug) {
    emailLines.push(
      "",
      `Product of interest: ${productSlug}`,
      `View product: https://louisluso.com/products/${productSlug}`,
    );
  }

  emailLines.push(
    "",
    "---",
    "This message was sent via the LOUISLUSO Dealer Locator.",
    "Reply directly to this email to respond to the customer.",
  );

  try {
    await sendEmail({
      to: dealer.email,
      subject: `Customer Inquiry via LOUISLUSO — ${customerName}`,
      replyTo: customerEmail,
      bcc: ["admin@louisluso.com"],
      body: emailLines.join("\n"),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/api/dealers-contact.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/dealers/[id]/contact/route.ts __tests__/app/api/dealers-contact.test.ts
git commit -m "feat: add POST /api/dealers/[id]/contact endpoint"
```

---

### Task 7: Add Mapbox Token to Environment

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Add NEXT_PUBLIC_MAPBOX_TOKEN to env schema**

Edit `lib/env.ts` — add after the Gmail section:

```typescript
  // Mapbox
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1, "NEXT_PUBLIC_MAPBOX_TOKEN is required"),
```

- [ ] **Step 2: Add to .env.local.example**

Add to `.env.local.example`:

```
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token
```

- [ ] **Step 3: Add your actual Mapbox token to .env.local**

Add your Mapbox public token to `.env.local` (gitignored). You can get one at https://account.mapbox.com/access-tokens/.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts .env.local.example
git commit -m "chore: add NEXT_PUBLIC_MAPBOX_TOKEN to env schema"
```

---

### Task 8: Install Mapbox GL JS

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mapbox-gl**

```bash
pnpm add mapbox-gl
pnpm add -D @types/mapbox-gl
```

- [ ] **Step 2: Verify installation**

Run: `pnpm test` (full suite — make sure nothing broke)
Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install mapbox-gl"
```

---

### Task 9: DealerCard Component

**Files:**
- Create: `app/components/DealerCard.tsx`
- Test: `__tests__/app/components/DealerCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/DealerCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DealerCard } from "@/app/components/DealerCard";
import type { Dealer } from "@/lib/dealers/types";

const mockDealer: Dealer = {
  id: "dealer-001",
  name: "Brilliant Eye Care",
  email: "info@brillianteye.example.com",
  phone: "(847) 555-0123",
  address: { street: "123 E Main St", city: "Arlington Heights", state: "IL", zip: "60004" },
  coordinates: { lat: 42.0884, lng: -87.9806 },
};

describe("DealerCard", () => {
  it("renders dealer name and location", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    expect(screen.getByText("Brilliant Eye Care")).toBeDefined();
    expect(screen.getByText("Arlington Heights, IL")).toBeDefined();
    expect(screen.getByText("2.3 mi")).toBeDefined();
  });

  it("renders Call link with tel: href", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    const callLink = screen.getByRole("link", { name: /call/i });
    expect(callLink.getAttribute("href")).toBe("tel:(847) 555-0123");
  });

  it("renders Directions link opening Google Maps", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    const dirLink = screen.getByRole("link", { name: /directions/i });
    expect(dirLink.getAttribute("href")).toContain("google.com/maps");
    expect(dirLink.getAttribute("target")).toBe("_blank");
  });

  it("calls onContact when Contact button clicked", async () => {
    const onContact = vi.fn();
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={onContact} />);
    await userEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(onContact).toHaveBeenCalledWith(mockDealer);
  });

  it("calls onSelect when card clicked", async () => {
    const onSelect = vi.fn();
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={onSelect} onContact={vi.fn()} />);
    await userEvent.click(screen.getByText("Brilliant Eye Care"));
    expect(onSelect).toHaveBeenCalledWith(mockDealer);
  });

  it("applies selected styles when selected", () => {
    const { container } = render(<DealerCard dealer={mockDealer} distance={2.3} selected={true} onSelect={vi.fn()} onContact={vi.fn()} />);
    const card = container.firstElementChild;
    expect(card?.className).toContain("border-l-bronze");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/components/DealerCard.test.tsx`
Expected: FAIL — module not found

Note: if `@testing-library/user-event` is not installed, run `pnpm add -D @testing-library/user-event` first.

- [ ] **Step 3: Implement DealerCard**

Create `app/components/DealerCard.tsx`:

```tsx
"use client";

import type { Dealer } from "@/lib/dealers/types";

interface DealerCardProps {
  dealer: Dealer;
  distance: number;
  selected: boolean;
  onSelect: (dealer: Dealer) => void;
  onContact: (dealer: Dealer) => void;
}

export function DealerCard({ dealer, distance, selected, onSelect, onContact }: DealerCardProps): React.ReactElement {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${dealer.address.street}, ${dealer.address.city}, ${dealer.address.state} ${dealer.address.zip}`
  )}`;

  return (
    <div
      className={`cursor-pointer border-b border-white/10 px-4 py-3.5 transition-colors ${
        selected
          ? "border-l-[3px] border-l-bronze bg-white/[0.03]"
          : "border-l-[3px] border-l-transparent hover:bg-white/[0.02]"
      }`}
      onClick={() => onSelect(dealer)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(dealer); }}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <span className={`text-[13px] font-semibold ${selected ? "text-white" : "text-gray-300"}`}>
          {dealer.name}
        </span>
        <span className={`ml-2 shrink-0 text-[11px] ${selected ? "text-bronze" : "text-gray-500"}`}>
          {distance} mi
        </span>
      </div>

      <p className="mb-2.5 text-[11px] text-gray-500">
        {dealer.address.city}, {dealer.address.state}
      </p>

      <div className="flex gap-1.5">
        <a
          href={`tel:${dealer.phone}`}
          aria-label="Call"
          className="flex-1 rounded border border-white/10 bg-white/[0.03] py-1.5 text-center text-[10px] text-gray-400 transition-colors hover:border-white/20 hover:text-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          Call
        </a>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Directions"
          className="flex-1 rounded border border-white/10 bg-white/[0.03] py-1.5 text-center text-[10px] text-gray-400 transition-colors hover:border-white/20 hover:text-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          Directions
        </a>
        <button
          aria-label="Contact"
          className="flex-[1.4] rounded bg-bronze py-1.5 text-center text-[10px] font-semibold text-white transition-colors hover:bg-bronze-light"
          onClick={(e) => {
            e.stopPropagation();
            onContact(dealer);
          }}
        >
          Contact
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/components/DealerCard.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/DealerCard.tsx __tests__/app/components/DealerCard.test.tsx
git commit -m "feat: add DealerCard component"
```

---

### Task 10: ContactDealerModal Component

**Files:**
- Create: `app/components/ContactDealerModal.tsx`
- Test: `__tests__/app/components/ContactDealerModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/app/components/ContactDealerModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactDealerModal } from "@/app/components/ContactDealerModal";
import type { Dealer } from "@/lib/dealers/types";

const mockDealer: Dealer = {
  id: "dealer-001",
  name: "Brilliant Eye Care",
  email: "info@brillianteye.example.com",
  phone: "(847) 555-0123",
  address: { street: "123 E Main St", city: "Arlington Heights", state: "IL", zip: "60004" },
  coordinates: { lat: 42.0884, lng: -87.9806 },
};

describe("ContactDealerModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dealer name in heading", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    expect(screen.getByText(/Contact Brilliant Eye Care/)).toBeDefined();
  });

  it("renders name, email, and message fields", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    expect(screen.getByLabelText(/your name/i)).toBeDefined();
    expect(screen.getByLabelText(/your email/i)).toBeDefined();
    expect(screen.getByLabelText(/message/i)).toBeDefined();
  });

  it("shows product context when productSlug provided", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug="sp1018" />);
    expect(screen.getByText(/sp1018/i)).toBeDefined();
  });

  it("calls onClose when X button clicked", async () => {
    const onClose = vi.fn();
    render(<ContactDealerModal dealer={mockDealer} onClose={onClose} productSlug={null} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", async () => {
    const onClose = vi.fn();
    render(<ContactDealerModal dealer={mockDealer} onClose={onClose} productSlug={null} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("submits form and shows success message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "John Smith");
    await userEvent.type(screen.getByLabelText(/your email/i), "john@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText(/we've sent your info/i)).toBeDefined();
    });
  });

  it("shows validation errors for empty required fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: "Invalid form data",
        details: { customerName: ["Name is required"] },
      }),
    });
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/app/components/ContactDealerModal.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ContactDealerModal**

Create `app/components/ContactDealerModal.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Dealer } from "@/lib/dealers/types";

interface ContactDealerModalProps {
  dealer: Dealer;
  onClose: () => void;
  productSlug: string | null;
}

export function ContactDealerModal({ dealer, onClose, productSlug }: ContactDealerModalProps): React.ReactElement {
  const [form, setForm] = useState({ customerName: "", customerEmail: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  function update(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGeneralError("");

    try {
      const response = await fetch(`/api/dealers/${dealer.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productSlug: productSlug ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            fieldErrors[key] = (msgs as string[])[0] ?? "";
          }
          setErrors(fieldErrors);
        } else {
          setGeneralError(data.error ?? "Something went wrong.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setGeneralError("Unable to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-white">Contact {dealer.name}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {dealer.address.city}, {dealer.address.state} &middot; {dealer.phone}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="text-lg text-gray-500 hover:text-gray-300">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {submitted ? (
            <div className="py-8 text-center">
              <p className="text-sm text-white">We&apos;ve sent your info to {dealer.name}.</p>
              <p className="mt-2 text-xs text-gray-500">They&apos;ll reply directly to your email.</p>
              <button
                onClick={handleClose}
                className="mt-6 rounded bg-bronze px-6 py-2 text-xs font-semibold text-white hover:bg-bronze-light"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {generalError && (
                <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {generalError}
                </div>
              )}

              {/* Name */}
              <div className="mb-3.5">
                <label htmlFor="customerName" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="customerName"
                  type="text"
                  required
                  value={form.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.customerName && <p className="mt-1 text-[11px] text-red-400">{errors.customerName}</p>}
              </div>

              {/* Email */}
              <div className="mb-3.5">
                <label htmlFor="customerEmail" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Your Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  required
                  value={form.customerEmail}
                  onChange={(e) => update("customerEmail", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.customerEmail && <p className="mt-1 text-[11px] text-red-400">{errors.customerEmail}</p>}
              </div>

              {/* Message */}
              <div className="mb-4">
                <label htmlFor="dealerMessage" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Message
                </label>
                <textarea
                  id="dealerMessage"
                  rows={3}
                  placeholder="I'm interested in trying on..."
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.message && <p className="mt-1 text-[11px] text-red-400">{errors.message}</p>}
              </div>

              {/* Product context */}
              {productSlug && (
                <div className="mb-4 flex items-center gap-3 rounded-md border border-bronze/20 bg-bronze/[0.06] px-3 py-2.5">
                  <div className="flex h-7 w-10 shrink-0 items-center justify-center rounded bg-bronze/20 text-[8px] text-bronze">
                    IMG
                  </div>
                  <div>
                    <p className="text-[11px] text-bronze">Asking about:</p>
                    <p className="text-xs text-gray-300">{productSlug}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-bronze py-2.5 text-[13px] font-semibold tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
              <p className="mt-2.5 text-center text-[10px] text-gray-600">
                Your info will be sent to the dealer. They&apos;ll reply directly to your email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/app/components/ContactDealerModal.test.tsx`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/ContactDealerModal.tsx __tests__/app/components/ContactDealerModal.test.tsx
git commit -m "feat: add ContactDealerModal component"
```

---

### Task 11: DealerMap Component

**Files:**
- Create: `app/components/DealerMap.tsx`

This is a Mapbox GL component that doesn't lend itself well to jsdom unit tests (WebGL context required). We'll test this through the integration of the full page. Here we just build the component.

- [ ] **Step 1: Create DealerMap component**

Create `app/components/DealerMap.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Dealer } from "@/lib/dealers/types";

interface DealerMapProps {
  dealers: Dealer[];
  selectedDealerId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onSelectDealer: (dealer: Dealer) => void;
  mapboxToken: string;
}

const DEFAULT_CENTER: [number, number] = [-87.9, 41.9]; // Chicago area
const DEFAULT_ZOOM = 4;
const FOCUSED_ZOOM = 11;

export function DealerMap({ dealers, selectedDealerId, userLocation, onSelectDealer, mapboxToken }: DealerMapProps): React.ReactElement {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : DEFAULT_CENTER;
    const zoom = userLocation ? FOCUSED_ZOOM : DEFAULT_ZOOM;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, userLocation]);

  // Update markers when dealers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    for (const dealer of dealers) {
      const isSelected = dealer.id === selectedDealerId;
      const size = isSelected ? 20 : 14;

      const el = document.createElement("div");
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = "50%";
      el.style.background = isSelected ? "#c4a265" : "#8B6F4E";
      el.style.border = `2px solid ${isSelected ? "#e8d5a8" : "#c4a265"}`;
      el.style.boxShadow = isSelected
        ? "0 0 20px rgba(196,162,101,0.8), 0 0 40px rgba(196,162,101,0.3)"
        : "0 0 12px rgba(139,111,78,0.6)";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s ease";

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dealer.coordinates.lng, dealer.coordinates.lat])
        .addTo(map);

      el.addEventListener("click", () => onSelectDealer(dealer));

      markersRef.current.push(marker);
    }
  }, [dealers, selectedDealerId, onSelectDealer]);

  // Fly to selected dealer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedDealerId) return;

    const dealer = dealers.find((d) => d.id === selectedDealerId);
    if (!dealer) return;

    map.flyTo({
      center: [dealer.coordinates.lng, dealer.coordinates.lat],
      zoom: 13,
      duration: 800,
    });
  }, [selectedDealerId, dealers]);

  return (
    <div ref={mapContainer} className="h-full w-full" />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -30` (quick check — may fail on missing page, that's fine)

- [ ] **Step 3: Commit**

```bash
git add app/components/DealerMap.tsx
git commit -m "feat: add DealerMap Mapbox GL component"
```

---

### Task 12: Find a Dealer Page

**Files:**
- Create: `app/find-a-dealer/page.tsx`
- Create: `app/find-a-dealer/FindADealerClient.tsx`

- [ ] **Step 1: Create the client orchestrator component**

Create `app/find-a-dealer/FindADealerClient.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { DealerMap } from "@/app/components/DealerMap";
import { DealerCard } from "@/app/components/DealerCard";
import { ContactDealerModal } from "@/app/components/ContactDealerModal";
import { sortDealersByDistance, filterDealersByRadius } from "@/lib/dealers/distance";
import type { Dealer } from "@/lib/dealers/types";
import type { DealerWithDistance } from "@/lib/dealers/distance";
import { MagnifyingGlassIcon, MapPinIcon } from "@heroicons/react/24/outline";

const RADIUS_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: 250, label: "250 mi" },
  { value: null, label: "All Dealers" },
] as const;

const NEXT_RADIUS: Record<number, number | null> = { 10: 25, 25: 50, 50: 100, 100: 250, 250: null };

interface FindADealerClientProps {
  mapboxToken: string;
}

export function FindADealerClient({ mapboxToken }: FindADealerClientProps): React.ReactElement {
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [filtered, setFiltered] = useState<DealerWithDistance[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [contactDealer, setContactDealer] = useState<Dealer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState<number | null>(25);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState(false);

  const productSlug = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("product")
    : null;

  // Fetch dealers
  useEffect(() => {
    async function fetchDealers(): Promise<void> {
      const res = await fetch("/api/dealers");
      const data = await res.json();
      setAllDealers(data.dealers);
      setLoading(false);
    }
    fetchDealers();
  }, []);

  // Request geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { timeout: 8000 },
    );
  }, []);

  // Filter dealers by location + radius
  useEffect(() => {
    if (allDealers.length === 0) return;

    if (userLocation) {
      const sorted = sortDealersByDistance(allDealers, userLocation.lat, userLocation.lng);
      setFiltered(filterDealersByRadius(sorted, radius));
    } else {
      // No location — show all with 0 distance
      setFiltered(allDealers.map((dealer) => ({ dealer, distance: 0 })));
    }
  }, [allDealers, userLocation, radius]);

  const handleNearMe = useCallback((): void => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(false);
      },
      () => setGeoError(true),
      { timeout: 8000 },
    );
  }, []);

  const handleSearch = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=US&limit=1`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        setUserLocation({ lat, lng });
        setGeoError(false);
      }
    } catch {
      // Geocoding failed — do nothing
    }
  }, [mapboxToken]);

  const handleExpandRadius = useCallback((): void => {
    if (radius === null) return;
    const next = NEXT_RADIUS[radius] ?? null;
    setRadius(next);
  }, [radius]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">Loading dealers...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0a0a0a] lg:flex-row">
      {/* Map */}
      <div className="relative h-[55vh] w-full lg:h-full lg:flex-[7]">
        {/* Search overlay */}
        <div className="absolute left-4 right-4 top-4 z-10 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a]/90 px-3 py-2.5 backdrop-blur-sm">
            <MagnifyingGlassIcon className="h-4 w-4 text-bronze" />
            <input
              type="text"
              placeholder="Search by city, state, or zip code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery);
              }}
              className="flex-1 bg-transparent text-[13px] text-gray-200 outline-none placeholder:text-gray-500"
            />
          </div>
          <button
            onClick={handleNearMe}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a1a]/90 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-bronze/30"
          >
            <MapPinIcon className="h-3.5 w-3.5 text-bronze" />
            <span className="text-xs text-gray-300">Near me</span>
          </button>
        </div>

        <DealerMap
          dealers={filtered.map((f) => f.dealer)}
          selectedDealerId={selectedDealer?.id ?? null}
          userLocation={userLocation}
          onSelectDealer={setSelectedDealer}
          mapboxToken={mapboxToken}
        />
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col border-t border-white/10 bg-[#111] lg:h-full lg:w-auto lg:flex-[3] lg:border-l lg:border-t-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
              {userLocation ? "Dealers Near You" : "All Dealers"}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {filtered.length} location{filtered.length !== 1 ? "s" : ""}
              {radius !== null && userLocation ? ` within ${radius} miles` : ""}
            </p>
          </div>

          {/* Radius selector */}
          {userLocation && (
            <select
              value={radius ?? "all"}
              onChange={(e) => setRadius(e.target.value === "all" ? null : Number(e.target.value))}
              className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-400 outline-none"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? "all"}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Dealer list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-400">
                No dealers{radius !== null ? ` within ${radius} miles` : ""}.
              </p>
              {radius !== null && NEXT_RADIUS[radius] !== undefined && (
                <button
                  onClick={handleExpandRadius}
                  className="mt-3 text-xs text-bronze hover:underline"
                >
                  Expand search to {NEXT_RADIUS[radius] === null ? "all dealers" : `${NEXT_RADIUS[radius]} mi`}
                </button>
              )}
              {radius === null && (
                <p className="mt-2 text-xs text-gray-600">
                  <a href="/contact" className="text-bronze hover:underline">Contact us directly</a> at cs@louisluso.com
                </p>
              )}
            </div>
          ) : (
            filtered.map((entry) => (
              <DealerCard
                key={entry.dealer.id}
                dealer={entry.dealer}
                distance={entry.distance}
                selected={selectedDealer?.id === entry.dealer.id}
                onSelect={setSelectedDealer}
                onContact={setContactDealer}
              />
            ))
          )}
        </div>
      </div>

      {/* Contact modal */}
      {contactDealer && (
        <ContactDealerModal
          dealer={contactDealer}
          onClose={() => setContactDealer(null)}
          productSlug={productSlug}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the server page wrapper**

Create `app/find-a-dealer/page.tsx`:

```tsx
import { FindADealerClient } from "./FindADealerClient";

export const metadata = {
  title: "Find a Dealer | LOUISLUSO",
  description: "Find an optical store near you that carries LOUISLUSO frames.",
};

export default function FindADealerPage(): React.ReactElement {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return <FindADealerClient mapboxToken={mapboxToken} />;
}
```

- [ ] **Step 3: Verify the dev server renders the page**

Run: `pnpm dev` and navigate to `http://localhost:3000/find-a-dealer`
Expected: dark map with search bar, sidebar with dealer cards, pins on map

- [ ] **Step 4: Commit**

```bash
git add app/find-a-dealer/page.tsx app/find-a-dealer/FindADealerClient.tsx
git commit -m "feat: add /find-a-dealer page with map, sidebar, and contact modal"
```

---

### Task 13: Mapbox CSS Import Fix

Mapbox GL requires its CSS to be loaded. Next.js App Router handles CSS imports in client components, but we need to ensure the import works correctly.

**Files:**
- Possibly modify: `app/components/DealerMap.tsx`

- [ ] **Step 1: Verify Mapbox CSS loads in dev**

Run: `pnpm dev`, open `/find-a-dealer`, and check if the map renders with proper controls and styling.

If the CSS import `import "mapbox-gl/dist/mapbox-gl.css"` causes issues in Next.js, add it to `app/globals.css` instead:

Add to `app/globals.css`:
```css
@import "mapbox-gl/dist/mapbox-gl.css";
```

And remove the import from `DealerMap.tsx`.

- [ ] **Step 2: Commit if changes were needed**

```bash
git add app/globals.css app/components/DealerMap.tsx
git commit -m "fix: ensure Mapbox GL CSS loads correctly"
```

---

### Task 14: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS (existing + new)

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:3000/find-a-dealer` and verify:
1. Map renders with dark style
2. Bronze pins appear for all dealers
3. Search bar accepts input, Enter triggers geocode search
4. "Near me" button requests geolocation
5. Clicking a pin highlights the card in sidebar
6. Clicking a card pans the map to that pin
7. "Contact" button opens modal
8. Modal form validates and submits
9. Success message appears after submission
10. Escape/X/backdrop click closes modal
11. Radius dropdown filters dealer list
12. Empty state shows expand button
13. Mobile layout stacks map on top

- [ ] **Step 4: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix: address smoke test findings"
```

---

### Task 15: Final Cleanup and Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 2: Run final build**

Run: `pnpm build`
Expected: Build succeeds, `/find-a-dealer` page included in output

- [ ] **Step 3: Run full test suite one final time**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: Phase 4 cleanup and lint fixes"
```
