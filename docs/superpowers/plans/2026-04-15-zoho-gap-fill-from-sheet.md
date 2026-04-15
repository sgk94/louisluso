# Zoho Books Contact Gap-Fill From Frozen Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Ken's read-only customer Google Sheet as a reference source to backfill missing fields on existing Zoho Books customer contacts, so Zoho becomes the authoritative, complete record.

**Architecture:**
- Sheet stays frozen — **no writes to the sheet, ever**.
- Two kinds of candidates per matched row:
  1. **Blank-fill**: a Zoho field is empty, the sheet has a value → propose writing it.
  2. **Conflict capture**: Zoho's `email` disagrees with the sheet's email → do NOT overwrite Zoho. Instead, append `(conflict) sheet-email@foo.com` to the Zoho contact's `notes` (idempotently — skip if the marker is already there). No data ever gets lost.
- Emit a preview CSV, Ken approves, then a second script PUTs updates to Zoho Books one contact at a time with a throttle and per-record dry-run/live toggle.
- No new customers get created in this plan — the 152 "only-in-Zoho" aren't backfillable from the sheet, and the 1 "only-in-sheet" is a junk row. Creation-from-sheet is explicitly out of scope.

**Tech Stack:** TypeScript (strict, tsx), Zod, Zoho Books REST API (`/books/v3/contacts`), Google Sheets API v4, Vitest for the pure transform.

---

## Decisions To Confirm Before Execution

These defaults are what the script will use unless Ken/Shawn override. Confirm or change before running Phase 3:

| # | Decision | Default |
|---|---|---|
| D1 | Which Zoho fields are eligible for gap-fill from the sheet? | `email`, `phone`, `company_name`, `shipping_address.city`, `shipping_address.state`. (Status is NOT — Zoho's status is authoritative.) |
| D2 | When Zoho has `contact.email` blank but `contact_persons[]` has an email, is that still a "gap"? | **No** — the person-level email counts; skip gap-fill for email in that case. |
| D3 | When the sheet says Active but Zoho says Inactive (or vice versa), do we push Status either way? | **No** — never overwrite `status` from the sheet. |
| D4 | Normalize casing before comparing? | Lowercase emails for compare; preserve sheet's original casing when writing (so `SHANSEN@WGEYECARE.COM` stays uppercase). |
| D5 | Throttle for Zoho Books writes? | 1 second between updates (Zoho Books limit is ~100/min; we stay well under). |
| D6 | Include `Inactive` Zoho customers in the gap-fill pass? | **Yes** — gaps are gaps regardless of status. |
| D7 | Out of scope for this plan: creating new Zoho contacts from sheet-only rows, or updating Zoho CRM Leads. Confirm? | Out of scope. Separate plan if needed. |
| D8 | When sheet email conflicts with Zoho email, capture sheet email in Zoho `notes` as `(conflict) sheet-email@foo.com`. Don't overwrite Zoho's email. | Confirmed by Shawn 2026-04-15. Only email conflicts get this treatment — phone/company conflicts are not captured to notes in this plan. |

---

## File Structure

| File | Role |
|---|---|
| `scripts/gap-fill/types.ts` | Shared TypeScript interfaces: `SheetRow`, `ZohoBooksContact`, `GapFillCandidate`, `FieldGap`. |
| `scripts/gap-fill/normalize.ts` | Pure helpers: `normEmail`, `normCompany`, `normPhone`, `buildMatchKey`. Reused between detect + apply. |
| `scripts/gap-fill/detect-gaps.ts` | Pulls sheet + Zoho Books, matches rows, emits `data/gap-fill/gaps-YYYY-MM-DD.json` + `.csv`. No writes to Zoho. |
| `scripts/gap-fill/apply-gaps.ts` | Reads the JSON from detect, PUTs updates to Zoho Books. Supports `--dry-run` (default) and `--live`. |
| `lib/zoho/books.ts` | **Modify**: add `getAllBooksCustomers()` (paginated) and `updateBooksContact(id, patch)`. |
| `__tests__/gap-fill/normalize.test.ts` | Unit tests for the normalize helpers. |
| `__tests__/gap-fill/detect-logic.test.ts` | Unit tests for the pure gap-detection rule (Zoho-blank + sheet-has + field-eligible). |
| `data/gap-fill/` | Gitignored output dir for run artifacts (preview JSON/CSV, backup). |
| `.gitignore` | **Modify**: add `data/gap-fill/`. |

---

## Phase 0: Preflight (human, no code)

- [ ] **Step 0.1: Confirm decisions D1–D7 with Ken/Shawn**

Before touching any code, walk through the seven decisions above and record answers inline in this file. If any default changes, update Phase 2 or Phase 3 accordingly.

- [ ] **Step 0.2: Verify the existing compare output hasn't changed underneath us**

Run the existing compare to re-snapshot current state:

```bash
set -a && source .env.local && set +a
npx tsx scripts/compare-zoho-sheet.ts
```

Expected: counts roughly match the prior run (715 sheet rows, ~868 Zoho customers, ~54 diffs, ~152 only-in-Zoho, 1 only-in-sheet). If numbers shift by more than ~5%, investigate before proceeding.

---

## Phase 1: Shared helpers + Zoho Books API extensions

### Task 1: Extract normalize helpers with tests

**Files:**
- Create: `scripts/gap-fill/normalize.ts`
- Create: `__tests__/gap-fill/normalize.test.ts`

- [ ] **Step 1.1: Write the failing test**

`__tests__/gap-fill/normalize.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { normEmail, normCompany, normPhone, buildMatchKey } from "../../scripts/gap-fill/normalize.ts";

describe("normalize helpers", () => {
  it("normEmail lowercases and trims", () => {
    expect(normEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
    expect(normEmail(undefined)).toBe("");
  });

  it("normCompany strips non-alphanumerics and lowercases", () => {
    expect(normCompany("VANITY OPTICAL - CAD")).toBe("vanityopticalcad");
    expect(normCompany("")).toBe("");
  });

  it("normPhone keeps only digits", () => {
    expect(normPhone("(630) 855-5542")).toBe("6308555542");
    expect(normPhone("")).toBe("");
  });

  it("buildMatchKey prefers email, falls back to company", () => {
    expect(buildMatchKey("FOO@bar.com", "Acme")).toBe("email:foo@bar.com");
    expect(buildMatchKey("", "Acme Optical")).toBe("company:acmeoptical");
    expect(buildMatchKey("", "")).toBe("");
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/gap-fill/normalize.test.ts`
Expected: FAIL — module `../../scripts/gap-fill/normalize.ts` not found.

- [ ] **Step 1.3: Implement the module**

`scripts/gap-fill/normalize.ts`:

```typescript
export function normEmail(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function normCompany(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function normPhone(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function buildMatchKey(email: string | undefined, company: string | undefined): string {
  const e = normEmail(email);
  if (e) return `email:${e}`;
  const c = normCompany(company);
  if (c) return `company:${c}`;
  return "";
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/gap-fill/normalize.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 1.5: Commit**

```bash
git add scripts/gap-fill/normalize.ts __tests__/gap-fill/normalize.test.ts
git commit -m "feat(gap-fill): add shared normalize helpers for Zoho/sheet matching"
```

### Task 2: Add `getAllBooksCustomers` + `updateBooksContact` to the Books client

**Files:**
- Modify: `lib/zoho/books.ts` (append at end)

- [ ] **Step 2.1: Append the helpers**

Append to `lib/zoho/books.ts`:

```typescript
export interface ZohoBooksAddress {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface ZohoBooksContactPerson {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

export interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  notes?: string;
  billing_address?: ZohoBooksAddress;
  shipping_address?: ZohoBooksAddress;
  contact_persons?: ZohoBooksContactPerson[];
  status: string;
  [key: string]: unknown;
}

interface BooksContactsPageResponse {
  contacts?: ZohoBooksContact[];
  page_context?: { has_more_page?: boolean; page?: number };
}

export async function getAllBooksCustomers(): Promise<ZohoBooksContact[]> {
  const all: ZohoBooksContact[] = [];
  let page = 1;
  while (true) {
    const res = await zohoFetch<BooksContactsPageResponse>("/books/v3/contacts", {
      params: { contact_type: "customer", page: String(page), per_page: "200" },
    });
    all.push(...(res.contacts ?? []));
    if (!res.page_context?.has_more_page) break;
    page += 1;
  }
  return all;
}

export interface BooksContactPatch {
  company_name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  shipping_address?: Partial<ZohoBooksAddress>;
}

export async function updateBooksContact(
  contactId: string,
  patch: BooksContactPatch,
): Promise<void> {
  await zohoFetch(`/books/v3/contacts/${contactId}`, {
    method: "PUT",
    body: patch as unknown as Record<string, unknown>,
  });
}
```

- [ ] **Step 2.2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add lib/zoho/books.ts
git commit -m "feat(zoho/books): add getAllBooksCustomers + updateBooksContact"
```

---

## Phase 2: Detect gaps (read-only, no writes)

### Task 3: Gap-detection rule with tests

**Files:**
- Create: `scripts/gap-fill/types.ts`
- Create: `scripts/gap-fill/detect-logic.ts`
- Create: `__tests__/gap-fill/detect-logic.test.ts`

- [ ] **Step 3.1: Write shared types**

`scripts/gap-fill/types.ts`:

```typescript
export interface SheetRow {
  companyName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
  rowIndex: number;
}

export type GapField =
  | "email"
  | "phone"
  | "company_name"
  | "shipping_city"
  | "shipping_state"
  | "notes_email_conflict";

export interface FieldGap {
  field: GapField;
  /** For blank-fill: the current (empty) value. For notes_email_conflict: the full current Zoho notes text. */
  currentZohoValue: string;
  /**
   * For blank-fill: the value to write.
   * For notes_email_conflict: the FULL new notes string (current notes + "\n(conflict) sheet-email"),
   * ready to PUT as-is. This keeps apply-gaps simple — no read-modify-write there.
   */
  proposedValue: string;
  sourceSheetRow: number;
}

export interface GapFillCandidate {
  contactId: string;
  zohoCompanyName: string;
  zohoContactName: string;
  matchKey: string;
  gaps: FieldGap[];
}
```

- [ ] **Step 3.2: Write the failing test**

`__tests__/gap-fill/detect-logic.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { detectGapsForPair } from "../../scripts/gap-fill/detect-logic.ts";
import type { SheetRow } from "../../scripts/gap-fill/types.ts";
import type { ZohoBooksContact } from "../../lib/zoho/books.ts";

function sheetRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    companyName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    status: "",
    rowIndex: 0,
    ...overrides,
  };
}

function zohoContact(overrides: Partial<ZohoBooksContact> = {}): ZohoBooksContact {
  return {
    contact_id: "1",
    contact_name: "",
    company_name: "",
    email: "",
    phone: "",
    status: "active",
    ...overrides,
  } as ZohoBooksContact;
}

describe("detectGapsForPair", () => {
  it("flags email when Zoho is blank and sheet has one", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "foo@bar.com", rowIndex: 42 }),
      zohoContact({ email: "" }),
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ field: "email", proposedValue: "foo@bar.com", sourceSheetRow: 42 });
  });

  it("does NOT flag email when Zoho contact_persons has one", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "foo@bar.com" }),
      zohoContact({ email: "", contact_persons: [{ email: "person@bar.com" }] }),
    );
    expect(gaps.find((g) => g.field === "email")).toBeUndefined();
  });

  it("flags shipping_city/state when Zoho is blank and sheet has values", () => {
    const gaps = detectGapsForPair(
      sheetRow({ city: "Chicago", state: "IL" }),
      zohoContact({ shipping_address: { city: "", state: "" } }),
    );
    expect(gaps.map((g) => g.field).sort()).toEqual(["shipping_city", "shipping_state"]);
  });

  it("does NOT flag when Zoho already has a value (even if different)", () => {
    const gaps = detectGapsForPair(
      sheetRow({ phone: "555-1111" }),
      zohoContact({ phone: "555-9999" }),
    );
    expect(gaps).toEqual([]);
  });

  it("does NOT propose status changes", () => {
    const gaps = detectGapsForPair(
      sheetRow({ status: "Active" }),
      zohoContact({ status: "inactive" }),
    );
    expect(gaps).toEqual([]);
  });

  it("flags company_name when Zoho blank AND contact_name doesn't already cover it", () => {
    const gaps = detectGapsForPair(
      sheetRow({ companyName: "Acme Optical" }),
      zohoContact({ company_name: "", contact_name: "Acme Optical" }),
    );
    // Zoho contact_name already holds it — not a gap.
    expect(gaps.find((g) => g.field === "company_name")).toBeUndefined();
  });

  it("flags company_name when Zoho company_name AND contact_name are both empty", () => {
    const gaps = detectGapsForPair(
      sheetRow({ companyName: "Acme Optical" }),
      zohoContact({ company_name: "", contact_name: "" }),
    );
    expect(gaps.find((g) => g.field === "company_name")?.proposedValue).toBe("Acme Optical");
  });

  it("captures email conflict into notes when both sides have emails and they differ", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "info@declark.com", rowIndex: 133 }),
      zohoContact({ email: "declark@declark.com", notes: "VIP customer" }),
    );
    const noteGap = gaps.find((g) => g.field === "notes_email_conflict");
    expect(noteGap).toBeDefined();
    expect(noteGap?.proposedValue).toBe("VIP customer\n(conflict) info@declark.com");
    expect(noteGap?.currentZohoValue).toBe("VIP customer");
    // Does NOT also flag a plain "email" blank-fill.
    expect(gaps.find((g) => g.field === "email")).toBeUndefined();
  });

  it("email conflict — when Zoho notes are empty, proposed notes start with the marker", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "info@declark.com" }),
      zohoContact({ email: "declark@declark.com" }), // notes undefined
    );
    const noteGap = gaps.find((g) => g.field === "notes_email_conflict");
    expect(noteGap?.proposedValue).toBe("(conflict) info@declark.com");
  });

  it("email conflict is IDEMPOTENT — skipped if notes already contain the exact marker", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "info@declark.com" }),
      zohoContact({
        email: "declark@declark.com",
        notes: "VIP customer\n(conflict) info@declark.com",
      }),
    );
    expect(gaps.find((g) => g.field === "notes_email_conflict")).toBeUndefined();
  });

  it("email conflict matches case-insensitively — INFO@DECLARK.COM vs info@declark.com = same, no conflict", () => {
    const gaps = detectGapsForPair(
      sheetRow({ email: "INFO@declark.com" }),
      zohoContact({ email: "info@declark.com" }),
    );
    expect(gaps).toEqual([]);
  });
});
```

- [ ] **Step 3.3: Run to verify it fails**

Run: `pnpm vitest run __tests__/gap-fill/detect-logic.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3.4: Implement detect-logic**

`scripts/gap-fill/detect-logic.ts`:

```typescript
import type { ZohoBooksContact } from "../../lib/zoho/books.ts";
import type { FieldGap, SheetRow } from "./types.ts";
import { normCompany, normEmail } from "./normalize.ts";

function isBlank(v: string | undefined): boolean {
  return !v || v.trim() === "";
}

function contactPersonsHaveEmail(c: ZohoBooksContact): boolean {
  return (c.contact_persons ?? []).some((p) => !isBlank(p.email));
}

function buildConflictNote(currentNotes: string, sheetEmail: string): string {
  const marker = `(conflict) ${sheetEmail.trim()}`;
  if (isBlank(currentNotes)) return marker;
  return `${currentNotes}\n${marker}`;
}

export function detectGapsForPair(
  sheet: SheetRow,
  zoho: ZohoBooksContact,
): FieldGap[] {
  const gaps: FieldGap[] = [];

  // Blank-fill: email
  if (!isBlank(sheet.email) && isBlank(zoho.email) && !contactPersonsHaveEmail(zoho)) {
    gaps.push({
      field: "email",
      currentZohoValue: "",
      proposedValue: sheet.email.trim(),
      sourceSheetRow: sheet.rowIndex,
    });
  }

  // Conflict capture: email (only when BOTH sides have emails and they differ)
  if (
    !isBlank(sheet.email) &&
    !isBlank(zoho.email) &&
    normEmail(sheet.email) !== normEmail(zoho.email)
  ) {
    const currentNotes = String(zoho.notes ?? "");
    const marker = `(conflict) ${sheet.email.trim()}`;
    // Idempotent: skip if the marker already exists anywhere in notes.
    if (!currentNotes.includes(marker)) {
      gaps.push({
        field: "notes_email_conflict",
        currentZohoValue: currentNotes,
        proposedValue: buildConflictNote(currentNotes, sheet.email),
        sourceSheetRow: sheet.rowIndex,
      });
    }
  }

  if (!isBlank(sheet.phone) && isBlank(zoho.phone)) {
    gaps.push({
      field: "phone",
      currentZohoValue: "",
      proposedValue: sheet.phone.trim(),
      sourceSheetRow: sheet.rowIndex,
    });
  }

  if (
    !isBlank(sheet.companyName) &&
    isBlank(zoho.company_name) &&
    normCompany(zoho.contact_name) !== normCompany(sheet.companyName)
  ) {
    gaps.push({
      field: "company_name",
      currentZohoValue: "",
      proposedValue: sheet.companyName.trim(),
      sourceSheetRow: sheet.rowIndex,
    });
  }

  const zCity = zoho.shipping_address?.city ?? "";
  const zState = zoho.shipping_address?.state ?? "";
  if (!isBlank(sheet.city) && isBlank(zCity)) {
    gaps.push({
      field: "shipping_city",
      currentZohoValue: "",
      proposedValue: sheet.city.trim(),
      sourceSheetRow: sheet.rowIndex,
    });
  }
  if (!isBlank(sheet.state) && isBlank(zState)) {
    gaps.push({
      field: "shipping_state",
      currentZohoValue: "",
      proposedValue: sheet.state.trim(),
      sourceSheetRow: sheet.rowIndex,
    });
  }

  return gaps;
}
```

- [ ] **Step 3.5: Run tests**

Run: `pnpm vitest run __tests__/gap-fill/`
Expected: PASS, all tests from Task 1 + Task 3.

- [ ] **Step 3.6: Commit**

```bash
git add scripts/gap-fill/types.ts scripts/gap-fill/detect-logic.ts __tests__/gap-fill/detect-logic.test.ts
git commit -m "feat(gap-fill): gap detection rule for Zoho Books contacts"
```

### Task 4: Gap-detection script — pulls both sides, emits preview artifacts

**Files:**
- Create: `scripts/gap-fill/detect-gaps.ts`
- Modify: `.gitignore`

- [ ] **Step 4.1: Add gitignore rule**

Append to `.gitignore`:

```
data/gap-fill/
```

- [ ] **Step 4.2: Implement detect-gaps script**

`scripts/gap-fill/detect-gaps.ts`:

```typescript
/**
 * Detect fields where Zoho Books is blank but the frozen sheet has a value.
 * Emits a JSON + CSV preview to data/gap-fill/. Makes ZERO writes to Zoho or the sheet.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/gap-fill/detect-gaps.ts [--sheet-id ID] [--gid GID]
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getSheetsClient } from "../../email/gmail.ts";
import { getAllBooksCustomers, type ZohoBooksContact } from "../../lib/zoho/books.ts";
import { detectGapsForPair } from "./detect-logic.ts";
import { buildMatchKey, normCompany } from "./normalize.ts";
import type { GapFillCandidate, SheetRow } from "./types.ts";

const DEFAULT_SHEET_ID = "1bhFOCJLjtXLxE-f6MLupu_ERIRNdnwvxnZeDQEC8KUs";
const DEFAULT_GID = "1821798516";
const OUT_DIR = "data/gap-fill";

function parseArgs(): { sheetId: string; gid: string } {
  const args = process.argv.slice(2);
  let sheetId = DEFAULT_SHEET_ID;
  let gid = DEFAULT_GID;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sheet-id") sheetId = args[++i] ?? sheetId;
    else if (args[i] === "--gid") gid = args[++i] ?? gid;
  }
  return { sheetId, gid };
}

async function fetchSheet(sheetId: string, gid: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tab = (meta.data.sheets ?? []).find(
    (s) => String(s.properties?.sheetId) === String(gid),
  );
  if (!tab?.properties?.title) throw new Error(`Tab gid=${gid} not found`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab.properties.title}'`,
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const col = (name: string): number => headers.findIndex((h) => h === name.toLowerCase());

  const companyIdx = col("Company Name");
  const emailIdx = col("EmailID");
  const phoneIdx = col("Phone");
  const cityIdx = col("Shipping City");
  const stateIdx = col("Shipping State");
  const statusIdx = col("Status");

  const out: SheetRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    out.push({
      companyName: String(r[companyIdx] ?? "").trim(),
      email: String(r[emailIdx] ?? "").trim(),
      phone: String(r[phoneIdx] ?? "").trim(),
      city: String(r[cityIdx] ?? "").trim(),
      state: String(r[stateIdx] ?? "").trim(),
      status: String(r[statusIdx] ?? "").trim(),
      rowIndex: i + 1,
    });
  }
  return out;
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCsv(candidates: GapFillCandidate[]): string {
  const header = [
    "contact_id",
    "zoho_company_name",
    "zoho_contact_name",
    "field",
    "current_zoho_value",
    "proposed_value",
    "source_sheet_row",
  ];
  const lines = [header.join(",")];
  for (const c of candidates) {
    for (const g of c.gaps) {
      lines.push(
        [
          c.contactId,
          c.zohoCompanyName,
          c.zohoContactName,
          g.field,
          g.currentZohoValue,
          g.proposedValue,
          String(g.sourceSheetRow),
        ].map(csvEscape).join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  const { sheetId, gid } = parseArgs();

  console.log("Fetching sheet...");
  const sheet = await fetchSheet(sheetId, gid);
  console.log(`  ${sheet.length} sheet rows`);

  console.log("Fetching Zoho Books customers...");
  const zoho = await getAllBooksCustomers();
  console.log(`  ${zoho.length} Zoho customers`);

  // Index Zoho by match key (email first, company second)
  const zohoByKey = new Map<string, ZohoBooksContact>();
  for (const c of zoho) {
    const k = buildMatchKey(c.email, c.company_name || c.contact_name);
    if (k && !zohoByKey.has(k)) zohoByKey.set(k, c);
  }
  const zohoByCompany = new Map<string, ZohoBooksContact>();
  for (const c of zoho) {
    const ck = normCompany(c.company_name || c.contact_name);
    if (ck && !zohoByCompany.has(ck)) zohoByCompany.set(ck, c);
  }

  const candidates: GapFillCandidate[] = [];
  for (const row of sheet) {
    const k = buildMatchKey(row.email, row.companyName);
    if (!k) continue;
    let zc = zohoByKey.get(k);
    if (!zc) {
      const ck = normCompany(row.companyName);
      if (ck) zc = zohoByCompany.get(ck);
    }
    if (!zc) continue; // no match — not in scope for this plan

    const gaps = detectGapsForPair(row, zc);
    if (gaps.length === 0) continue;

    candidates.push({
      contactId: zc.contact_id,
      zohoCompanyName: zc.company_name ?? "",
      zohoContactName: zc.contact_name ?? "",
      matchKey: k,
      gaps,
    });
  }

  const counts = candidates.reduce<Record<string, number>>((acc, c) => {
    for (const g of c.gaps) acc[g.field] = (acc[g.field] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n=== GAP SUMMARY ===");
  console.log(`  Contacts with at least one gap: ${candidates.length}`);
  console.log(`  Total field gaps: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  for (const [k, v] of Object.entries(counts)) console.log(`    ${k}: ${v}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = join(OUT_DIR, `gaps-${stamp}.json`);
  const csvPath = join(OUT_DIR, `gaps-${stamp}.csv`);
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), counts, candidates }, null, 2));
  writeFileSync(csvPath, toCsv(candidates));
  console.log(`\n  JSON: ${jsonPath}`);
  console.log(`  CSV:  ${csvPath}`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 4.3: Run against live Zoho (read-only, safe)**

```bash
set -a && source .env.local && set +a
npx tsx scripts/gap-fill/detect-gaps.ts
```

Expected: console prints a summary with per-field counts; two files dropped in `data/gap-fill/gaps-YYYY-MM-DD.{json,csv}`.

- [ ] **Step 4.4: Open the CSV and sanity-check**

```bash
head -30 data/gap-fill/gaps-*.csv
wc -l data/gap-fill/gaps-*.csv
```

Expected: header + one row per field gap. Spot-check 3–5 contacts by looking them up in Zoho Books UI and the sheet — make sure the proposed value is actually better than the blank.

- [ ] **Step 4.5: Commit the scripts (artifacts are gitignored)**

```bash
git add scripts/gap-fill/detect-gaps.ts .gitignore
git commit -m "feat(gap-fill): detect-gaps script emits preview JSON/CSV"
```

---

## Phase 3: Human review gate (mandatory)

- [ ] **Step H1: Share `data/gap-fill/gaps-*.csv` with Ken for review**

Ken (or Shawn) reviews each proposed gap-fill. Options per row:
- Accept as-is → no action.
- Reject → delete the row from the CSV.
- Edit proposed_value → change the cell in the CSV.

- [ ] **Step H2: Save the approved CSV**

Ken saves back to `data/gap-fill/gaps-approved.csv`. Only rows present in this file will be written to Zoho.

- [ ] **Step H3: DO NOT PROCEED to Phase 4 without this file.**

The `apply-gaps.ts` script in Phase 4 will refuse to run if `gaps-approved.csv` is missing.

---

## Phase 4: Apply approved gaps to Zoho Books

### Task 5: apply-gaps script — dry-run by default

**Files:**
- Create: `scripts/gap-fill/apply-gaps.ts`

- [ ] **Step 5.1: Implement**

`scripts/gap-fill/apply-gaps.ts`:

```typescript
/**
 * Apply approved gap-fills from data/gap-fill/gaps-approved.csv to Zoho Books.
 * Defaults to --dry-run. Pass --live to actually write.
 *
 * Usage:
 *   npx tsx scripts/gap-fill/apply-gaps.ts          # dry-run, safe
 *   npx tsx scripts/gap-fill/apply-gaps.ts --live   # writes to Zoho
 */
import "dotenv/config";
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { updateBooksContact, type BooksContactPatch } from "../../lib/zoho/books.ts";

const APPROVED_PATH = process.env.APPROVED_PATH ?? "data/gap-fill/gaps-approved.csv";
const LOG_PATH = join("data/gap-fill", `apply-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.jsonl`);
const THROTTLE_MS = 1000;

interface ApprovedRow {
  contact_id: string;
  field: string;
  proposed_value: string;
  source_sheet_row: string;
}

function parseCsv(text: string): ApprovedRow[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const ci = headers.indexOf("contact_id");
  const fi = headers.indexOf("field");
  const pi = headers.indexOf("proposed_value");
  const ri = headers.indexOf("source_sheet_row");
  if (ci < 0 || fi < 0 || pi < 0) throw new Error("CSV missing required columns");

  const out: ApprovedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    out.push({
      contact_id: cols[ci] ?? "",
      field: cols[fi] ?? "",
      proposed_value: cols[pi] ?? "",
      source_sheet_row: cols[ri] ?? "",
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function groupByContact(rows: ApprovedRow[]): Map<string, ApprovedRow[]> {
  const m = new Map<string, ApprovedRow[]>();
  for (const r of rows) {
    if (!m.has(r.contact_id)) m.set(r.contact_id, []);
    m.get(r.contact_id)!.push(r);
  }
  return m;
}

function buildPatch(rows: ApprovedRow[]): BooksContactPatch {
  const patch: BooksContactPatch = {};
  const addr: Record<string, string> = {};
  for (const r of rows) {
    switch (r.field) {
      case "email": patch.email = r.proposed_value; break;
      case "phone": patch.phone = r.proposed_value; break;
      case "company_name": patch.company_name = r.proposed_value; break;
      case "shipping_city": addr.city = r.proposed_value; break;
      case "shipping_state": addr.state = r.proposed_value; break;
      case "notes_email_conflict":
        // proposed_value is the FULL new notes blob (current + "(conflict) ..."),
        // precomputed by detect-gaps. Write as-is.
        patch.notes = r.proposed_value;
        break;
    }
  }
  if (Object.keys(addr).length > 0) patch.shipping_address = addr;
  return patch;
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");

  if (!existsSync(APPROVED_PATH)) {
    console.error(`Missing ${APPROVED_PATH}. Complete Phase 3 (human review) first.`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(APPROVED_PATH, "utf-8"));
  const byContact = groupByContact(rows);
  console.log(`Approved rows: ${rows.length} across ${byContact.size} contacts`);
  console.log(`Mode: ${live ? "LIVE (will write to Zoho)" : "DRY RUN"}`);

  writeFileSync(LOG_PATH, "");

  let ok = 0;
  let fail = 0;
  for (const [contactId, contactRows] of byContact) {
    const patch = buildPatch(contactRows);
    const logEntry = { ts: new Date().toISOString(), contactId, patch, mode: live ? "live" : "dry-run" };

    if (!live) {
      console.log(`  [dry] ${contactId} ← ${JSON.stringify(patch)}`);
      appendFileSync(LOG_PATH, JSON.stringify({ ...logEntry, status: "skipped" }) + "\n");
      continue;
    }

    try {
      await updateBooksContact(contactId, patch);
      console.log(`  [ok]  ${contactId}`);
      appendFileSync(LOG_PATH, JSON.stringify({ ...logEntry, status: "ok" }) + "\n");
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [err] ${contactId}: ${msg}`);
      appendFileSync(LOG_PATH, JSON.stringify({ ...logEntry, status: "error", error: msg }) + "\n");
      fail++;
    }

    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  console.log(`\nDone. ok=${ok} fail=${fail}  log=${LOG_PATH}`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 5.2: Dry-run against the approved CSV**

```bash
set -a && source .env.local && set +a
npx tsx scripts/gap-fill/apply-gaps.ts
```

Expected: prints each contact + the patch it would send. No network calls to Zoho write endpoints. Log written to `data/gap-fill/apply-log-*.jsonl` with `status: skipped`.

- [ ] **Step 5.3: Review the dry-run log**

```bash
cat data/gap-fill/apply-log-*.jsonl | head -20
```

Confirm patches match expectations. If anything looks wrong, edit `gaps-approved.csv` and re-run the dry-run.

- [ ] **Step 5.4: Commit**

```bash
git add scripts/gap-fill/apply-gaps.ts
git commit -m "feat(gap-fill): apply-gaps script — dry-run default, --live writes"
```

### Task 6: Live run (first 5 contacts only — canary)

- [ ] **Step 6.1: Create a canary CSV with the first 5 contacts**

```bash
head -1 data/gap-fill/gaps-approved.csv > data/gap-fill/gaps-canary.csv
head -6 data/gap-fill/gaps-approved.csv | tail -5 >> data/gap-fill/gaps-canary.csv
APPROVED_PATH=data/gap-fill/gaps-canary.csv npx tsx scripts/gap-fill/apply-gaps.ts --live
```

Note: the first command preserves the header row; the second appends the next 5 data rows. The script reads `APPROVED_PATH` from env (Step 5.1), so the canary path is picked up without modifying the script.

Expected: 5 updates go through. Log shows 5 × `status: ok`.

- [ ] **Step 6.2: Verify in Zoho Books UI**

Open the 5 updated contacts in the Zoho Books web UI. Confirm the fields we pushed actually show up.

- [ ] **Step 6.3: If any issue, STOP — roll back manually via Zoho UI and diagnose.**

Rollback steps: open the contact, revert the field(s), save. The apply log has the exact patches we sent, so the reverse is known.

- [ ] **Step 6.4: If canary is clean, run the full live apply**

```bash
npx tsx scripts/gap-fill/apply-gaps.ts --live
```

Expected: remaining contacts updated. Any errors logged to the JSONL.

- [ ] **Step 6.5: Commit the approved CSV + log as a record**

```bash
# data/gap-fill/ is gitignored, so this just documents the run in the commit message.
git commit --allow-empty -m "chore(gap-fill): ran live apply-gaps (see data/gap-fill/apply-log-*.jsonl)"
```

---

## Phase 5: Verify + close the loop

- [ ] **Step 7.1: Re-run detect-gaps**

```bash
npx tsx scripts/gap-fill/detect-gaps.ts
```

Expected: the gap counts should be near zero for the fields we approved. Any remaining gaps are either rejected-by-Ken (fine) or writes that failed (check the apply log).

- [ ] **Step 7.2: Diff the before/after counts**

Compare `data/gap-fill/gaps-YYYY-MM-DD.json` from before and after. The delta should match the approved + ok rows from the apply log.

- [ ] **Step 7.3: Update CLAUDE.md**

Note in `CLAUDE.md` under "Scripts & Files":

```
### Gap-fill Scripts (`scripts/gap-fill/`)
- `detect-gaps.ts` — cross-references frozen sheet vs Zoho Books; emits gap CSV/JSON (no writes)
- `apply-gaps.ts` — applies approved gap-fills to Zoho Books; `--live` to write
```

Commit:

```bash
git add CLAUDE.md
git commit -m "docs: document gap-fill scripts in CLAUDE.md"
```

---

## Rollback

If a mass write goes wrong:
1. Stop the script immediately.
2. Read `data/gap-fill/apply-log-*.jsonl`. Each `status: ok` entry records the exact patch sent.
3. For each: fetch the current Zoho contact, compare to patch, manually revert via Zoho UI (there is no per-field audit/undo API in Books).
4. The original sheet is untouched — still available as reference.

## Out of Scope (separate plans if needed)

- Creating new Zoho Books customers from sheet-only rows (there's only 1, which is a junk row).
- Syncing the 152 "only-in-Zoho" contacts *to* the sheet (sheet is read-only per Shawn).
- Backfilling Zoho CRM Leads from the sheet.
- Automating continuous sync (this is a one-shot cleanup).
