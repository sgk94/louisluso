# Regional CRM Contact System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Zoho CRM the source of truth for contacts, with structured location data (state, city, zip, region) and a growing knowledge base so business card scans auto-enrich location data and regional email blasts pull contacts by metro area.

**Architecture:** Region config maps zip prefixes to metro-area slugs. A local JSON knowledge base learns city→zip→region mappings over time. Business card scans write to Zoho CRM (primary) + Google Sheet (Ken's view). A CRM pull script queries leads by region/state/city and writes to `contacts.json` for existing email sequences.

**Tech Stack:** TypeScript, Zoho CRM v6 API, Google Sheets API, Vitest

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/crm/regions.ts` | Region definitions array + `matchRegion(zip)` + `loadKnowledgeBase()` + `updateKnowledgeBase()` |
| `data/location-kb.json` | Location knowledge base (city→state/zip/region mappings, starts as `{}`) |
| `scripts/crm-pull.ts` | CLI to pull CRM leads by `--region`, `--state`, or `--city` into `email/contacts.json` |
| `__tests__/lib/crm/regions.test.ts` | Unit tests for region matching and knowledge base |
| `__tests__/lib/zoho/crm-leads-search.test.ts` | Unit tests for `searchLeads()` |
| `__tests__/scripts/crm-pull.test.ts` | Integration test for CRM pull → contacts.json |

### Modified Files
| File | Changes |
|------|---------|
| `lib/zoho/crm.ts` | Add `Region` to `CRMLeadInput`, add `searchLeads()` function |
| `scripts/append-contact.ts` | Replace contacts.json write with `createLead()` call, keep Sheet append, add knowledge base update |
| `.claude/skills/business-card-scan/SKILL.md` | Updated flow with location enrichment, CRM write, knowledge base |

---

### Task 1: Region Config & Matching Logic

**Files:**
- Create: `lib/crm/regions.ts`
- Create: `data/location-kb.json`
- Test: `__tests__/lib/crm/regions.test.ts`

- [ ] **Step 1: Create empty knowledge base file**

Create `data/location-kb.json`:
```json
{}
```

- [ ] **Step 2: Write failing tests for region matching**

Create `__tests__/lib/crm/regions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchRegion, REGIONS, type Region } from "@/lib/crm/regions";

describe("REGIONS", () => {
  it("exports a non-empty array of regions", () => {
    expect(REGIONS.length).toBeGreaterThan(0);
  });

  it("each region has slug, name, and zipPrefixes", () => {
    for (const r of REGIONS) {
      expect(r.slug).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.zipPrefixes.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate slugs", () => {
    const slugs = REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("matchRegion", () => {
  it("matches SoCal zip 90001", () => {
    expect(matchRegion("90001")).toBe("socal");
  });

  it("matches SoCal zip 93500 (high end of range)", () => {
    expect(matchRegion("93500")).toBe("socal");
  });

  it("matches NorCal zip 94102 (San Francisco)", () => {
    expect(matchRegion("94102")).toBe("norcal");
  });

  it("matches Dallas zip 75201", () => {
    expect(matchRegion("75201")).toBe("dallas");
  });

  it("matches Austin zip 78701", () => {
    expect(matchRegion("78701")).toBe("austin");
  });

  it("returns null for zip with no matching region", () => {
    expect(matchRegion("99999")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchRegion("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(matchRegion(undefined)).toBeNull();
  });

  it("handles zip with leading zeros", () => {
    // 060xx = Connecticut, no region defined
    expect(matchRegion("06001")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/lib/crm/regions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement region config and matching**

Create `lib/crm/regions.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface Region {
  slug: string;
  name: string;
  zipPrefixes: string[]; // "900-935" means 900xx through 935xx
}

export const REGIONS: Region[] = [
  { slug: "socal", name: "Southern California", zipPrefixes: ["900-935"] },
  { slug: "norcal", name: "Northern California", zipPrefixes: ["936-961"] },
  { slug: "dallas", name: "Dallas / Fort Worth", zipPrefixes: ["750-753", "760-761"] },
  { slug: "austin", name: "Austin", zipPrefixes: ["786-787"] },
  { slug: "houston", name: "Houston", zipPrefixes: ["770-775"] },
];

export function matchRegion(zip: string | undefined): string | null {
  if (!zip || zip.length < 3) return null;

  const prefix = parseInt(zip.substring(0, 3), 10);
  if (isNaN(prefix)) return null;

  for (const region of REGIONS) {
    for (const range of region.zipPrefixes) {
      const [startStr, endStr] = range.split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : start;

      if (prefix >= start && prefix <= end) {
        return region.slug;
      }
    }
  }

  return null;
}

export function getRegionName(slug: string): string | null {
  const region = REGIONS.find((r) => r.slug === slug);
  return region?.name ?? null;
}

export interface KnowledgeBaseEntry {
  state: string;
  city: string;
  zip: string;
  region: string | null;
}

const KB_PATH = join(process.cwd(), "data", "location-kb.json");

export function loadKnowledgeBase(): Record<string, KnowledgeBaseEntry> {
  if (!existsSync(KB_PATH)) return {};
  return JSON.parse(readFileSync(KB_PATH, "utf-8")) as Record<string, KnowledgeBaseEntry>;
}

export function lookupCity(city: string, state: string): KnowledgeBaseEntry | null {
  const kb = loadKnowledgeBase();
  const key = `${city.toLowerCase().trim()}, ${state.toLowerCase().trim()}`;
  return kb[key] ?? null;
}

export function updateKnowledgeBase(
  city: string,
  state: string,
  zip: string,
  region: string | null,
): void {
  const kb = loadKnowledgeBase();
  const key = `${city.toLowerCase().trim()}, ${state.toLowerCase().trim()}`;

  kb[key] = {
    state: state.toUpperCase().trim(),
    city: city.trim(),
    zip,
    region,
  };

  writeFileSync(KB_PATH, JSON.stringify(kb, null, 2) + "\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/lib/crm/regions.test.ts`
Expected: All PASS

- [ ] **Step 6: Write tests for knowledge base functions**

Append to `__tests__/lib/crm/regions.test.ts`:

```ts
import { lookupCity, updateKnowledgeBase, loadKnowledgeBase } from "@/lib/crm/regions";
import { writeFileSync } from "fs";
import { join } from "path";

const KB_PATH = join(process.cwd(), "data", "location-kb.json");

describe("knowledge base", () => {
  beforeEach(() => {
    // Reset KB to empty before each test
    writeFileSync(KB_PATH, "{}\n");
  });

  afterAll(() => {
    // Clean up — restore empty KB
    writeFileSync(KB_PATH, "{}\n");
  });

  it("lookupCity returns null for unknown city", () => {
    expect(lookupCity("Nowhere", "XX")).toBeNull();
  });

  it("updateKnowledgeBase writes entry and lookupCity finds it", () => {
    updateKnowledgeBase("Dallas", "TX", "75201", "dallas");

    const entry = lookupCity("Dallas", "TX");
    expect(entry).toEqual({
      state: "TX",
      city: "Dallas",
      zip: "75201",
      region: "dallas",
    });
  });

  it("lookupCity is case-insensitive", () => {
    updateKnowledgeBase("Los Angeles", "CA", "90001", "socal");

    expect(lookupCity("los angeles", "ca")).toEqual({
      state: "CA",
      city: "Los Angeles",
      zip: "90001",
      region: "socal",
    });
  });

  it("updateKnowledgeBase overwrites existing entry", () => {
    updateKnowledgeBase("Austin", "TX", "78701", null);
    updateKnowledgeBase("Austin", "TX", "78701", "austin");

    const entry = lookupCity("Austin", "TX");
    expect(entry?.region).toBe("austin");
  });

  it("loadKnowledgeBase returns all entries", () => {
    updateKnowledgeBase("Dallas", "TX", "75201", "dallas");
    updateKnowledgeBase("Houston", "TX", "77001", "houston");

    const kb = loadKnowledgeBase();
    expect(Object.keys(kb)).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run all region tests**

Run: `pnpm vitest run __tests__/lib/crm/regions.test.ts`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add lib/crm/regions.ts data/location-kb.json __tests__/lib/crm/regions.test.ts
git commit -m "feat: add region config, zip matching, and location knowledge base"
```

---

### Task 2: Extend Zoho CRM with Region Field and Lead Search

**Files:**
- Modify: `lib/zoho/crm.ts:21-33` (CRMLeadInput interface)
- Modify: `lib/zoho/crm.ts` (add searchLeads function)
- Test: `__tests__/lib/zoho/crm.test.ts`
- Create: `__tests__/lib/zoho/crm-leads-search.test.ts`

- [ ] **Step 1: Write failing test for Region in CRMLeadInput**

Add to `__tests__/lib/zoho/crm.test.ts` inside the `createLead` describe block, after the existing "includes optional fields" test:

```ts
    it("includes Region custom field when provided", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        data: [
          {
            status: "success",
            details: { id: "lead-789" },
          },
        ],
      });

      const input: CRMLeadInput = {
        Company: "Bay Area Vision",
        First_Name: "Kim",
        Last_Name: "Lee",
        Email: "kim@bayareavision.com",
        Phone: "415-555-0100",
        Street: "100 Market St",
        City: "San Francisco",
        State: "CA",
        Zip_Code: "94102",
        Region: "norcal",
        Lead_Source: "Business Card",
      };

      const id = await createLead(input);

      expect(id).toBe("lead-789");
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads", {
        method: "POST",
        body: { data: [input] },
      });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lib/zoho/crm.test.ts`
Expected: FAIL — TypeScript error, `Region` not in `CRMLeadInput`

- [ ] **Step 3: Add Region to CRMLeadInput**

In `lib/zoho/crm.ts`, add `Region` to the interface:

```ts
export interface CRMLeadInput {
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street: string;
  City: string;
  State: string;
  Zip_Code: string;
  Region?: string;
  Lead_Source?: string;
  Description?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/lib/zoho/crm.test.ts`
Expected: All PASS

- [ ] **Step 5: Write failing test for searchLeads**

Create `__tests__/lib/zoho/crm-leads-search.test.ts`:

```ts
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
    ZOHO_ORG_ID: "org-123",
  },
}));

import { searchLeads } from "@/lib/zoho/crm";

describe("searchLeads", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("searches by Region criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-1",
          Company: "LA Optical",
          First_Name: "Jane",
          Last_Name: "Doe",
          Email: "jane@laoptical.com",
          Phone: "310-555-0100",
          City: "Los Angeles",
          State: "CA",
          Zip_Code: "90001",
          Region: "socal",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(Region:equals:socal)");

    expect(leads).toHaveLength(1);
    expect(leads[0].Email).toBe("jane@laoptical.com");
    expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads/search", {
      params: { criteria: "(Region:equals:socal)", per_page: "200" },
    });
  });

  it("searches by State criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-2",
          Company: "TX Eye",
          First_Name: "Bob",
          Last_Name: "Smith",
          Email: "bob@txeye.com",
          Phone: "214-555-0100",
          City: "Dallas",
          State: "TX",
          Zip_Code: "75201",
          Region: "dallas",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(State:equals:TX)");

    expect(leads).toHaveLength(1);
    expect(leads[0].Company).toBe("TX Eye");
  });

  it("searches by City criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-3",
          Company: "Austin Specs",
          First_Name: "Pat",
          Last_Name: "K",
          Email: "pat@austinspecs.com",
          Phone: "512-555-0100",
          City: "Austin",
          State: "TX",
          Zip_Code: "78701",
          Region: "austin",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(City:equals:Austin)");

    expect(leads).toHaveLength(1);
  });

  it("returns empty array when no matches", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: null, info: { more_records: false } });

    const leads = await searchLeads("(Region:equals:nowhere)");

    expect(leads).toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lib/zoho/crm-leads-search.test.ts`
Expected: FAIL — `searchLeads` not exported

- [ ] **Step 7: Implement searchLeads**

Add to `lib/zoho/crm.ts`:

```ts
export interface CRMLead {
  id: string;
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street?: string;
  City?: string;
  State?: string;
  Zip_Code?: string;
  Region?: string;
  Lead_Source?: string;
  Description?: string;
  [key: string]: unknown;
}

interface SearchLeadsResponse {
  data: CRMLead[] | null;
  info: { more_records: boolean };
}

export async function searchLeads(criteria: string): Promise<CRMLead[]> {
  const response = await zohoFetch<SearchLeadsResponse>("/crm/v6/Leads/search", {
    params: { criteria, per_page: "200" },
  });

  return response.data ?? [];
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/lib/zoho/crm-leads-search.test.ts && pnpm vitest run __tests__/lib/zoho/crm.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add lib/zoho/crm.ts __tests__/lib/zoho/crm.test.ts __tests__/lib/zoho/crm-leads-search.test.ts
git commit -m "feat: add Region to CRM leads and searchLeads function"
```

---

### Task 3: Rework append-contact.ts — CRM Primary + Sheet + Knowledge Base

**Files:**
- Modify: `scripts/append-contact.ts`

- [ ] **Step 1: Read current append-contact.ts for reference**

The current script does: parse JSON arg → append to Google Sheet → add to contacts.json. We're changing it to: parse JSON arg → enrich with region → createLead in Zoho CRM → append to Google Sheet → update knowledge base. No more contacts.json write.

- [ ] **Step 2: Rewrite append-contact.ts**

Replace the contents of `scripts/append-contact.ts`:

```ts
import "dotenv/config";
import { getSheetsClient } from "../email/gmail.js";
import { createLead, type CRMLeadInput } from "../lib/zoho/crm.js";
import { matchRegion, lookupCity, updateKnowledgeBase } from "../lib/crm/regions.js";

const SHEET_ID = "1xWFgNlWI0GKnwPJ-btI9Yx9MaWaEwx42P-gQWnxQwpw";
const SHEET_RANGE = "Sheet1!A:P";

interface CardContact {
  name: string;
  email: string;
  company: string;
  type: string;
  role: string;
  location: string;
  tags: string[];
  source: string;
  notes: string;
  phone: string;
  website: string;
  address: string;
  state: string;
  city: string;
  zip: string;
}

function parseArgs(): CardContact {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: npx tsx scripts/append-contact.ts '<JSON>'");
    process.exit(1);
  }
  const parsed = JSON.parse(raw) as Partial<CardContact>;
  return {
    name: parsed.name ?? "",
    email: parsed.email ?? "",
    company: parsed.company ?? "",
    type: parsed.type ?? "",
    role: parsed.role ?? "",
    location: parsed.location ?? "",
    tags: parsed.tags ?? ["business-card"],
    source: parsed.source ?? "business-card",
    notes: parsed.notes ?? "",
    phone: parsed.phone ?? "",
    website: parsed.website ?? "",
    address: parsed.address ?? "",
    state: parsed.state ?? "",
    city: parsed.city ?? "",
    zip: parsed.zip ?? "",
  };
}

function enrichLocation(contact: CardContact): { state: string; city: string; zip: string; region: string | null } {
  let { state, city, zip } = contact;

  // If we have city + state but no zip, try the knowledge base
  if (city && state && !zip) {
    const known = lookupCity(city, state);
    if (known) {
      zip = known.zip;
      console.log(`KB: resolved ${city}, ${state} → zip ${zip}`);
    }
  }

  // Auto-assign region from zip
  const region = matchRegion(zip);

  return { state, city, zip, region };
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function writeToZohoCRM(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null }): Promise<string> {
  const { first, last } = splitName(contact.name);

  const leadInput: CRMLeadInput = {
    Company: contact.company || "Unknown",
    First_Name: first,
    Last_Name: last || first, // Zoho requires Last_Name
    Email: contact.email,
    Phone: contact.phone,
    Street: contact.address,
    City: location.city,
    State: location.state,
    Zip_Code: location.zip,
    Region: location.region ?? undefined,
    Lead_Source: contact.source === "business-card" ? "Business Card" : contact.source,
    Description: [
      contact.role ? `Role: ${contact.role}` : "",
      contact.type ? `Type: ${contact.type}` : "",
      contact.website ? `Website: ${contact.website}` : "",
      contact.notes,
    ].filter(Boolean).join(" | "),
  };

  const leadId = await createLead(leadInput);
  console.log(`CRM: created lead ${leadId} for ${contact.name} (${contact.email})`);
  return leadId;
}

async function appendToSheet(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null }): Promise<void> {
  const sheets = getSheetsClient();
  const now = new Date().toISOString().split("T")[0];
  const row = [
    contact.name,
    contact.email,
    contact.company,
    contact.type,
    contact.role,
    contact.location,
    contact.tags.join(";"),
    contact.source,
    contact.notes,
    "new",          // Status
    "0",            // Email Count
    "",             // Last Contacted
    contact.phone,
    contact.website,
    contact.address,
    location.region ?? "",  // Region (new column P)
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  console.log(`Sheet: appended row for ${contact.name} (${contact.email})`);
}

async function main(): Promise<void> {
  const contact = parseArgs();

  if (!contact.email) {
    console.error("Error: email is required");
    process.exit(1);
  }

  // Enrich location from knowledge base
  const location = enrichLocation(contact);

  if (location.region) {
    console.log(`Region: ${location.region}`);
  } else {
    console.log("Region: none (no matching zip prefix)");
  }

  // Write to Zoho CRM (primary)
  await writeToZohoCRM(contact, location);

  // Append to Google Sheet (Ken's readable view)
  await appendToSheet(contact, location);

  // Update knowledge base if we have city + state + zip
  if (location.city && location.state && location.zip) {
    updateKnowledgeBase(location.city, location.state, location.zip, location.region);
    console.log(`KB: saved ${location.city}, ${location.state} → ${location.zip} (${location.region ?? "no region"})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/append-contact.ts
git commit -m "feat: rework append-contact to write CRM + Sheet + knowledge base"
```

---

### Task 4: CRM Pull Script

**Files:**
- Create: `scripts/crm-pull.ts`
- Test: `__tests__/scripts/crm-pull.test.ts`

- [ ] **Step 1: Write failing test for CRM pull logic**

Create `__tests__/scripts/crm-pull.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSearchLeads } = vi.hoisted(() => ({
  mockSearchLeads: vi.fn(),
}));

vi.mock("@/lib/zoho/crm", () => ({
  searchLeads: mockSearchLeads,
}));

import { buildCriteria, leadsToContacts } from "../scripts/crm-pull-lib.js";

describe("buildCriteria", () => {
  it("builds Region criteria", () => {
    expect(buildCriteria({ region: "socal" })).toBe("(Region:equals:socal)");
  });

  it("builds State criteria", () => {
    expect(buildCriteria({ state: "TX" })).toBe("(State:equals:TX)");
  });

  it("builds City criteria", () => {
    expect(buildCriteria({ city: "Dallas" })).toBe("(City:equals:Dallas)");
  });

  it("throws when no filter provided", () => {
    expect(() => buildCriteria({})).toThrow("Provide --region, --state, or --city");
  });
});

describe("leadsToContacts", () => {
  it("converts CRM leads to Contact format", () => {
    const leads = [
      {
        id: "lead-1",
        Company: "LA Optical",
        First_Name: "Jane",
        Last_Name: "Doe",
        Email: "jane@laoptical.com",
        Phone: "310-555-0100",
        City: "Los Angeles",
        State: "CA",
        Zip_Code: "90001",
        Region: "socal",
        Lead_Source: "Business Card",
      },
    ];

    const contacts = leadsToContacts(leads);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toEqual({
      email: "jane@laoptical.com",
      name: "Jane Doe",
      company: "LA Optical",
      type: "",
      role: "",
      location: "Los Angeles, CA",
      tags: ["crm-import", "socal"],
      source: "zoho-crm",
      notes: "",
      status: "new",
      emailCount: 0,
      lastContacted: "",
      createdAt: expect.any(String),
    });
  });

  it("skips leads without email", () => {
    const leads = [
      {
        id: "lead-2",
        Company: "No Email Co",
        First_Name: "Bob",
        Last_Name: "X",
        Email: "",
        Phone: "555-0000",
      },
    ];

    const contacts = leadsToContacts(leads);

    expect(contacts).toHaveLength(0);
  });

  it("adds region tag when present", () => {
    const leads = [
      {
        id: "lead-3",
        Company: "DFW Eyes",
        First_Name: "Pat",
        Last_Name: "K",
        Email: "pat@dfweyes.com",
        Phone: "214-555-0100",
        Region: "dallas",
      },
    ];

    const contacts = leadsToContacts(leads);

    expect(contacts[0].tags).toContain("dallas");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/scripts/crm-pull.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create crm-pull-lib.ts (testable logic)**

Create `scripts/crm-pull-lib.ts`:

```ts
import type { CRMLead } from "../lib/zoho/crm.js";
import type { Contact } from "../email/contacts.js";

export interface PullFilter {
  region?: string;
  state?: string;
  city?: string;
}

export function buildCriteria(filter: PullFilter): string {
  if (filter.region) return `(Region:equals:${filter.region})`;
  if (filter.state) return `(State:equals:${filter.state})`;
  if (filter.city) return `(City:equals:${filter.city})`;
  throw new Error("Provide --region, --state, or --city");
}

export function leadsToContacts(leads: CRMLead[]): Contact[] {
  const now = new Date().toISOString();

  return leads
    .filter((lead) => lead.Email)
    .map((lead) => {
      const tags = ["crm-import"];
      if (lead.Region) tags.push(String(lead.Region));

      const locationParts = [lead.City, lead.State].filter(Boolean);

      return {
        email: String(lead.Email).toLowerCase().trim(),
        name: `${lead.First_Name ?? ""} ${lead.Last_Name ?? ""}`.trim(),
        company: String(lead.Company ?? ""),
        type: "",
        role: "",
        location: locationParts.join(", "),
        tags,
        source: "zoho-crm",
        notes: "",
        status: "new",
        emailCount: 0,
        lastContacted: "",
        createdAt: now,
      };
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/scripts/crm-pull.test.ts`
Expected: All PASS

- [ ] **Step 5: Create crm-pull.ts CLI script**

Create `scripts/crm-pull.ts`:

```ts
import "dotenv/config";
import { searchLeads } from "../lib/zoho/crm.js";
import { saveContacts } from "../email/contacts.js";
import { buildCriteria, leadsToContacts, type PullFilter } from "./crm-pull-lib.js";
import { getRegionName } from "../lib/crm/regions.js";

function parseArgs(): PullFilter {
  const args = process.argv.slice(2);
  const filter: PullFilter = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--region":
        filter.region = args[++i];
        break;
      case "--state":
        filter.state = args[++i];
        break;
      case "--city":
        filter.city = args[++i];
        break;
      default:
        console.error(`Unknown flag: ${args[i]}`);
        process.exit(1);
    }
  }

  return filter;
}

async function main(): Promise<void> {
  const filter = parseArgs();
  const criteria = buildCriteria(filter);

  const label = filter.region
    ? getRegionName(filter.region) ?? filter.region
    : filter.state ?? filter.city ?? "unknown";

  console.log(`Pulling leads: ${criteria}`);

  const leads = await searchLeads(criteria);
  console.log(`Found ${leads.length} leads for "${label}"`);

  if (leads.length === 0) {
    console.log("No contacts to write.");
    return;
  }

  const contacts = leadsToContacts(leads);
  saveContacts(contacts);
  console.log(`Wrote ${contacts.length} contacts to contacts.json`);
  console.log("Ready for email enrollment.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 6: Add crm:pull script to package.json**

Add to `package.json` scripts:

```json
"crm:pull": "tsx scripts/crm-pull.ts"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/crm-pull.ts scripts/crm-pull-lib.ts __tests__/scripts/crm-pull.test.ts package.json
git commit -m "feat: add CRM pull script for regional contact export"
```

---

### Task 5: Update Business Card Scan Skill

**Files:**
- Modify: `.claude/skills/business-card-scan/SKILL.md`

- [ ] **Step 1: Rewrite the skill file**

Replace `.claude/skills/business-card-scan/SKILL.md` with updated flow:

```markdown
---
name: business-card-scan
description: Scan a business card photo and extract contact info into Zoho CRM (primary) and Google Sheet (backup view). Use this skill whenever the user provides a business card image, mentions scanning a card, wants to add a contact from a card, or says anything about business cards, name cards, or contact cards — even if they don't say "scan" explicitly.
allowed-tools: Bash, Read, Write, Edit
---

# Business Card Scanner

Extract contact information from business card photos and add them to Zoho CRM (primary) + Google Sheet (Ken's view).

## How it works

You receive a business card image. You read every piece of text on the card using your vision capability, map it to the contact fields below, enrich the location data, show the user for confirmation, then run the append script.

## Step 1: Extract all text from the card

Read the image carefully. Pull out every piece of text you can see — names, titles, emails, phone numbers, addresses, websites, company names, taglines, fax numbers, social handles, everything.

Business cards vary wildly in layout. Some put the name huge and centered, others bury it. Some have multiple phone numbers or emails. Use context clues (font size, position, formatting) to figure out what's what.

If the card is in a language other than English, extract the text as-is and also provide an English translation where helpful (e.g., for the company name or title).

## Step 2: Map to contact fields and enrich location

Map extracted text to these fields:

| Field | What goes here |
|-------|---------------|
| Name | Full name (first + last) |
| Email | Email address — required, skip the card if missing |
| Company | Company or practice name |
| Type | Business type if apparent (e.g., "optician", "distributor", "optical store") |
| Role | Job title / position |
| Location | City, State or general location |
| Tags | Default: `business-card` — add context tags like trade show name if mentioned |
| Source | Where the card was collected (ask user if not obvious, default: `business-card`) |
| Notes | Anything that doesn't fit other fields — fax, second phone, social handles, tagline |
| Phone | Primary phone number |
| Website | Website URL |
| Address | Full street address |
| State | Two-letter state abbreviation (e.g., CA, TX) — parse from address or city line |
| City | City name — parse from address or city line |
| Zip | ZIP code — parse from address. If only city+state available, check knowledge base |

**Location enrichment:** If the card has city + state but no zip code, check the knowledge base by running:
```bash
npx tsx -e "import { lookupCity } from './lib/crm/regions.js'; const r = lookupCity('CITY', 'STATE'); console.log(r ? JSON.stringify(r) : 'not found')"
```
If found, use the stored zip. If not found, leave zip blank — it'll get filled in next time we see that city with a zip.

**Region auto-assign:** The append script handles this automatically from the zip code. You don't need to figure out the region — just show it in the confirmation table if it resolves.

## Step 3: Show for confirmation

Present the extracted data in a clean table so the user can review it before it gets saved:

```
Extracted from business card:

Name:     John Smith
Email:    john@example.com
Company:  ABC Optical
Type:     optical store
Role:     Owner
Location: Dallas, TX
State:    TX
City:     Dallas
Zip:      75201
Region:   dallas (auto-assigned)
Tags:     business-card; vision-expo-2026
Source:   business-card
Notes:    Fax: 555-0199
Phone:    (555) 555-0123
Website:  abcoptical.com
Address:  123 Main St, Dallas, TX 75201
```

Ask: "Look good? I'll add this to Zoho CRM and the Sheet. Let me know if anything needs fixing."

If the card has no email address, tell the user and ask if they want to proceed anyway or skip it.

## Step 4: Write to Zoho CRM + Sheet + knowledge base

Once confirmed, run:

```bash
npx tsx scripts/append-contact.ts '<JSON>'
```

Where `<JSON>` is a single-line JSON string with these fields:
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "company": "ABC Optical",
  "type": "optical store",
  "role": "Owner",
  "location": "Dallas, TX",
  "tags": ["business-card", "vision-expo-2026"],
  "source": "business-card",
  "notes": "Fax: 555-0199",
  "phone": "(555) 555-0123",
  "website": "abcoptical.com",
  "address": "123 Main St, Dallas, TX 75201",
  "state": "TX",
  "city": "Dallas",
  "zip": "75201"
}
```

The script will:
1. Auto-assign region from zip code
2. Create a Lead in Zoho CRM (with state, city, zip, region fields)
3. Append a row to Google Sheet (Ken's view)
4. Update the location knowledge base (if new city+state+zip combo)

## Batch mode

If the user provides multiple card images at once, process them one at a time — extract, show for review, wait for confirmation, then move to the next. Don't batch-confirm because the user might want to correct individual cards.

## Edge cases

- **No email on card**: Flag it. Ask if user wants to add anyway (CRM + sheet, but won't be enrollable in email sequences) or skip.
- **Duplicate email**: Zoho CRM allows duplicate leads. Mention this to the user if you suspect a duplicate.
- **Low quality / unreadable text**: Tell the user which parts you couldn't read. Ask them to fill in the gaps.
- **Multiple people on one card**: Rare, but create separate entries for each person if it happens.
- **No address at all**: Set state, city, zip to empty. The contact gets `region: null` — it can be tagged manually later.
- **City + state but no zip**: Check knowledge base (Step 2). If not found, leave zip blank. Region won't auto-assign but city/state are still searchable.

## Key files

- `scripts/append-contact.ts` — Writes to Zoho CRM + Google Sheet + updates knowledge base
- `lib/crm/regions.ts` — Region config, zip matching, knowledge base read/write
- `lib/zoho/crm.ts` — Zoho CRM API (createLead)
- `data/location-kb.json` — Location knowledge base (grows over time)
- `email/gmail.ts` — Google Sheets API client (OAuth2)
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/business-card-scan/SKILL.md
git commit -m "feat: update business card scan skill for CRM + regional enrichment"
```

---

### Task 6: Run Full Test Suite & Verify

**Files:**
- No new files

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run`
Expected: All tests pass, including new region/CRM tests

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit if any fixes were needed**

Only if fixes were required:
```bash
git add -A
git commit -m "fix: resolve test/type issues from regional CRM integration"
```
