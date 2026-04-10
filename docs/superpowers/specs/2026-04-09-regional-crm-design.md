# Regional CRM Contact System

> Date: 2026-04-09
> Status: Approved design, ready for implementation

## Problem

Business card contacts currently go to Google Sheets + local `contacts.json`. There's no centralized CRM, no region data, and no way to pull "all SoCal contacts" for a trip email blast.

## Solution

Zoho CRM becomes the source of truth. Contacts get enriched with structured location data (state, city, zip, region) on scan. A local knowledge base learns city→zip→region mappings over time. Email sequences pull contacts from CRM by region.

## Architecture

### Data Flow

```
Scan card
  → Extract text (vision)
  → Enrich location (knowledge base lookup, region auto-assign)
  → User confirms
  → Write to Zoho CRM (createLead)
  → Append to Google Sheet (Ken's view)
  → Update knowledge base (if new city data)

Email blast for a trip
  → Pull contacts from CRM by region
  → Write to contacts.json
  → Enroll in email sequence
  → Send
```

### Contact Location Fields (on CRM Lead)

| Field | Example | Source |
|-------|---------|--------|
| Street | 123 Main St | Business card |
| City | Los Angeles | Business card or knowledge base |
| State | CA | Business card or knowledge base |
| Zip_Code | 90001 | Business card or knowledge base |
| Region | socal | Auto-assigned from zip prefix match |

All five fields stored independently so you can query at any level (state, city, region, zip range).

### Region Config (`lib/crm/regions.ts`)

Regions are metro-area / trip-level, not state-level. Add-as-you-go by adding one object:

```ts
interface Region {
  slug: string;        // "socal", "dallas", "norcal"
  name: string;        // "Southern California"
  zipPrefixes: string[]; // ["900-935"]
}
```

Examples:
- `{ slug: "socal", name: "Southern California", zipPrefixes: ["900-935"] }`
- `{ slug: "norcal", name: "Northern California", zipPrefixes: ["936-961"] }`
- `{ slug: "dallas", name: "Dallas / Fort Worth", zipPrefixes: ["750-753", "760-761"] }`
- `{ slug: "austin", name: "Austin", zipPrefixes: ["786-787"] }`

Matching logic: zip prefix match first (most precise). If no zip available, no auto-assign — region can be tagged manually.

Contacts in zips that don't match any defined region get `region: null`. They become matchable once you add a region covering their area.

### Location Knowledge Base (`data/location-kb.json`)

Maps known cities to full location data. Grows automatically as cards are scanned:

```json
{
  "los angeles, ca": { "state": "CA", "city": "Los Angeles", "zip": "90001", "region": "socal" },
  "dallas, tx": { "state": "TX", "city": "Dallas", "zip": "75201", "region": "dallas" }
}
```

- Starts empty, fills in over time
- Key is lowercase `"city, state_abbrev"`
- When a card has full address → state, city, zip all extracted → knowledge base entry created automatically
- When a future card only has "City, State" (no zip) → look up here first
- Zero API calls — local JSON lookup
- Region field updated when new regions are added (re-run assign script)

### Updated Business Card Scan Skill

Changes to `.claude/skills/business-card-scan/SKILL.md`:

1. **Extract text** — same as today
2. **Enrich location** — parse address into State, City, Zip. If only City+State, look up knowledge base. Auto-assign region from zip prefix.
3. **Confirm** — show table with State, City, Zip, Region fields added
4. **Write to Zoho CRM** — `createLead()` with all fields including Region custom field
5. **Append to Google Sheet** — same as today for Ken's view
6. **Update knowledge base** — add new city→zip→region mapping if we saw a new combo
7. **No contacts.json write** — that file gets populated by CRM pull instead

### CRM Lead Input (extended)

```ts
interface CRMLeadInput {
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street: string;
  City: string;
  State: string;
  Zip_Code: string;
  Region?: string;      // custom field — "socal", "dallas", etc.
  Lead_Source?: string;
  Description?: string;
}
```

Note: `Region` requires a custom field created in Zoho CRM (Settings → Modules → Leads → Fields → Add Custom Field → Single Line, API name: `Region`).

### CRM Pull for Email Sequences

New CLI command to pull contacts from Zoho CRM into `contacts.json`:

```bash
pnpm crm:pull -- --region socal
pnpm crm:pull -- --state CA
pnpm crm:pull -- --city Dallas
```

- Queries Zoho CRM leads by filter field
- Writes matching contacts to `contacts.json` (replaces file contents)
- Existing email sequence system works unchanged — reads from contacts.json

Full trip email workflow:
```bash
pnpm crm:pull -- --region socal
pnpm email:enroll -- --sequence socal-visit-apr-2026 --tag business-card
pnpm email:sequence -- run --sequence socal-visit-apr-2026
```

### Zoho CRM API Cost

- Free/Standard: 5,000 API calls/day
- Card scan: 1 write call per card
- Regional pull: 1-2 read calls (paginated at 200)
- Knowledge base: local JSON, zero API calls
- Even heavy usage (50-100 calls/day) is well within limits

## Files to Create / Modify

### New Files
- `lib/crm/regions.ts` — Region definitions + matching logic
- `data/location-kb.json` — Location knowledge base (starts empty `{}`)
- `scripts/crm-pull.ts` — CLI to pull CRM contacts by region/state/city into contacts.json

### Modified Files
- `lib/zoho/crm.ts` — Extend `CRMLeadInput` with Region, add `getLeadsByFilter()` function
- `scripts/append-contact.ts` — Rework to call createLead() + Sheet append instead of just Sheet + contacts.json
- `.claude/skills/business-card-scan/SKILL.md` — Updated flow with location enrichment and CRM write

### Zoho CRM Setup (manual, one-time)
- Create custom field "Region" on Leads module (single-line text, API name: `Region`)

## Testing

- Unit tests for region matching (zip prefix → region slug)
- Unit tests for knowledge base lookup/update
- Unit tests for CRM lead input construction from card data
- Integration test for CRM pull → contacts.json pipeline (mocked Zoho API)

## What's NOT in Scope

- Zoho Territory Management (overkill for add-as-you-go)
- Auto-geocoding from address (zip prefix matching is sufficient)
- Regional email templates (use existing template system, just segment the audience)
- Migrating existing Google Sheet contacts into CRM (can do later)
