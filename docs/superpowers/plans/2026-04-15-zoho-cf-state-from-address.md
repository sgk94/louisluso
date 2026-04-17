# Backfill `cf_state` / `cf_city` From Existing Zoho Shipping Address — Implementation Plan

> Supersedes the sheet-based gap-fill for state/city. The previous plan
> (`2026-04-15-zoho-gap-fill-from-sheet.md`) wrote to `shipping_address.state`,
> but our outreach filter reads the custom field `cf_state`. This plan derives
> `cf_state` / `cf_city` from data Zoho already has.

**Goal:** Populate the custom fields `cf_state` (2-letter code) and `cf_city`
on every Zoho Books customer that's currently missing them, so trip-targeted
outreach (GA / CA / TX, etc.) returns the full audience.

**Why now:** Of 869 customers, only 269 have `cf_state`. Spot check shows
many "missing" customers actually have `shipping_address.state` populated —
the value just hasn't been mirrored into the custom field used for filtering.

**Architecture:**
1. List all Books customers (cheap, paginated).
2. Filter to "missing `cf_state`" (also missing `cf_city` — same code path).
3. Per-contact GET (the only endpoint that returns full address blocks).
4. Derive a 2-letter state code from `shipping_address` → fallback `billing_address`.
5. Emit a preview JSON/CSV for human review.
6. After approval: PUT `cf_state` / `cf_city` back, throttled, dry-run by default.

**Sheet is out of scope here.** A second pass can fall back to the sheet for
contacts with no address at all (~150 estimated) — separate plan if needed.

> **Hard constraint — DO NOT TOUCH ANY OTHER ZOHO FIELDS.** This plan writes
> only `cf_state` and `cf_city`. Email, phone, company name, addresses, notes,
> status, payment terms, contact persons, tags, and every other field on
> every contact stay exactly as they are. The PUT patch must contain *only*
> the two custom fields — never include any other key, even if Zoho returns
> them unchanged on the GET. The detect script must not propose changes to
> anything else, and the apply script must reject any approved-CSV row whose
> field is not `cf_state` or `cf_city`.

**Tech Stack:** TypeScript (strict, tsx), Zoho Books REST API, Vitest for the
pure state-normalization helper.

---

## Decisions To Confirm Before Execution

| # | Decision | Default |
|---|---|---|
| D1 | Source priority for state? | `shipping_address.state` → `billing_address.state` fallback. |
| D2 | Also fill `cf_city`? | **Yes** — same data shape, free pass. Source = `shipping_address.city` → billing fallback. |
| D3 | Normalize state to 2-letter code? | **Yes**. "California" → `CA`. Reject anything that doesn't resolve to a known US state code or Canadian province code (skip + log). |
| D4 | Handle Canadian provinces? | **Yes** — write 2-letter province code (`ON`, `BC`, etc.). Existing `cf_state: "CANADA"` stays as-is (don't normalize away from country-as-state since we don't have province data). |
| D5 | Overwrite existing `cf_state` if it disagrees with shipping_address.state? | **No** — never overwrite. Only fill blanks. |
| D6 | Throttle for per-contact GET + PUT? | 1 second between calls (matches the prior plan; ~17 min for 600 reads + ~10 min for writes). |
| D7 | Backup before live run? | **Yes** — write `data/cf-state-fill/backup-{ts}.json` containing every targeted contact's current `cf_state` + `cf_city` before any PUT. |
| D8 | Out of scope? | Sheet fallback (separate plan). Updating CRM Leads. Updating non-customer Zoho contacts. |

---

## File Structure

| File | Role |
|---|---|
| `scripts/cf-state-fill/state-codes.ts` | Pure helper: `toStateCode(input, country?)` → 2-letter code or null. US + CA province lookups. |
| `__tests__/cf-state-fill/state-codes.test.ts` | Vitest cases: full names, codes, mixed case, garbage, Canadian provinces. |
| `scripts/cf-state-fill/detect.ts` | Lists customers, filters to missing `cf_state`, GETs each, derives state/city, emits preview JSON + CSV. No writes. |
| `scripts/cf-state-fill/apply.ts` | Reads approved CSV, writes backup, PUTs `cf_state` / `cf_city`. `--dry-run` default; `--live` to write. |
| `lib/zoho/books.ts` | **Modify**: add `getBooksContact(id)` (per-contact GET) + extend `BooksContactPatch` with `custom_fields: { api_name, value }[]`. |
| `data/cf-state-fill/` | Gitignored output dir for preview, backup, apply log. |
| `.gitignore` | **Modify**: add `data/cf-state-fill/`. |

---

## Phase 0: Preflight

- [ ] **Step 0.1: Confirm decisions D1–D8 with Shawn.** Default values above will be used unless overridden.
- [ ] **Step 0.2: Re-snapshot current state**

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/count-books-by-state.ts
```

Expected baseline (as of 2026-04-15): 869 customers, 269 with `cf_state`, 600 missing.

---

## Phase 1: State-code helper (TDD)

### Task 1: `toStateCode` with tests

**Files:** `scripts/cf-state-fill/state-codes.ts`, `__tests__/cf-state-fill/state-codes.test.ts`

- [ ] **Step 1.1: Failing test**

```typescript
import { describe, expect, it } from "vitest";
import { toStateCode } from "../../scripts/cf-state-fill/state-codes.ts";

describe("toStateCode", () => {
  it("returns code unchanged when already a US 2-letter code", () => {
    expect(toStateCode("CA")).toBe("CA");
    expect(toStateCode("ca")).toBe("CA");
    expect(toStateCode(" TX ")).toBe("TX");
  });

  it("maps full US state names to codes", () => {
    expect(toStateCode("California")).toBe("CA");
    expect(toStateCode("new york")).toBe("NY");
  });

  it("maps Canadian province names + codes", () => {
    expect(toStateCode("British Columbia")).toBe("BC");
    expect(toStateCode("ON")).toBe("ON");
  });

  it("returns null for garbage", () => {
    expect(toStateCode("")).toBeNull();
    expect(toStateCode("not a state")).toBeNull();
    expect(toStateCode(undefined)).toBeNull();
  });

  it("does not collide US 'CA' with Canada when country hint provided", () => {
    expect(toStateCode("CA", "Canada")).toBeNull(); // CA is not a province code
    expect(toStateCode("CA", "USA")).toBe("CA");
    expect(toStateCode("CA")).toBe("CA"); // default = US treatment
  });
});
```

- [ ] **Step 1.2: Implement** — small module with two const maps (US_STATES, CA_PROVINCES). Country hint biases lookup; without hint, US wins.
- [ ] **Step 1.3: Tests green.**
- [ ] **Step 1.4: Commit** — `feat(cf-state-fill): state code normalizer`

---

## Phase 2: Books client extensions

### Task 2: `getBooksContact` + custom-field patch support

**Files:** `lib/zoho/books.ts`

- [ ] **Step 2.1:** Add `getBooksContact(id)` returning the full per-contact response (with `shipping_address`, `billing_address`, `cf_state`, `cf_city`).
- [ ] **Step 2.2:** Extend `BooksContactPatch` to support custom fields. Zoho Books takes them as `custom_fields: [{ api_name, value }]`.
- [ ] **Step 2.3:** Typecheck. Commit — `feat(zoho/books): per-contact GET + custom-field patch support`

---

## Phase 3: Detect (read-only)

### Task 3: `detect.ts`

**Files:** `scripts/cf-state-fill/detect.ts`, `.gitignore`

- [ ] **Step 3.1:** Add `data/cf-state-fill/` to `.gitignore`.
- [ ] **Step 3.2:** Implement `detect.ts`:
  - Pull all Books customers.
  - Filter to: `cf_state` blank OR `cf_city` blank (separately tracked).
  - For each, per-contact GET (1s throttle).
  - Derive: `state = toStateCode(shipping_address.state ?? billing_address.state, country)`; `city = (shipping ?? billing).city`.
  - Bucket each contact into one of: `fillable-both`, `fillable-state-only`, `fillable-city-only`, `no-source`, `unresolvable-state` (state present but didn't normalize), `would-overwrite` (cf_state already set — should be 0 if our list filter is correct, but log defensively).
  - Emit `data/cf-state-fill/preview-YYYY-MM-DD.json` + `.csv` with: `contact_id`, `contact_name`, `current_cf_state`, `proposed_cf_state`, `current_cf_city`, `proposed_cf_city`, `source` (shipping/billing/none), `country`.
  - Print a summary: counts per bucket + a state distribution histogram of proposed values.
- [ ] **Step 3.3: Run it live (read-only).** Spot-check 10 random rows in the Zoho UI — does the proposed value match what's actually on the contact?
- [ ] **Step 3.4: Commit** — `feat(cf-state-fill): detect script — derives cf_state/cf_city from address`

---

## Phase 4: Human review gate

- [ ] **Step H1:** Shawn reviews `preview-*.csv`. Reject any rows where the proposed value looks wrong by deleting them. Edit cells to override individual values if needed.
- [ ] **Step H2:** Save approved subset as `data/cf-state-fill/approved.csv`.
- [ ] **Step H3:** Apply script refuses to run without this file.

---

## Phase 5: Apply

### Task 4: `apply.ts`

**Files:** `scripts/cf-state-fill/apply.ts`

- [ ] **Step 4.1: Implement.** Read `approved.csv`, group by contact_id, build patch with `custom_fields: [{ api_name: "cf_state", value }, { api_name: "cf_city", value }]`. Skip rows where proposed equals current. **Reject any row whose `field` column is not `cf_state` or `cf_city` — exit with an error rather than write anything else.** The patch object passed to `updateBooksContact` must contain exactly one key: `custom_fields`.
- [ ] **Step 4.2: Backup.** Before any PUT, write `data/cf-state-fill/backup-{ts}.json` containing every targeted contact's current `cf_state` + `cf_city`.
- [ ] **Step 4.3: Dry-run first** (default).
- [ ] **Step 4.4: Canary.** Live-write the first 5 rows. Verify in Zoho UI.
- [ ] **Step 4.5: Full live run** if canary clean.
- [ ] **Step 4.6: Commit** — `feat(cf-state-fill): apply script — dry-run default, --live writes`

---

## Phase 6: Verify

- [ ] **Step 6.1:** Re-run `count-books-by-state.ts` — `withCfState` should jump from 269 to roughly 269 + (approved rows). GA / CA / TX buckets should grow.
- [ ] **Step 6.2:** Update CLAUDE.md "Scripts & Files" with the new `scripts/cf-state-fill/*` entries.

---

## Rollback

`backup-{ts}.json` records pre-write `cf_state` + `cf_city` per contact. To
revert: replay it as a patch (single quick script) — same throttle, same
shape. Original Zoho data stays in `shipping_address` / `billing_address`
untouched, so we can always re-derive.

---

## Out of Scope

- Sheet fallback for contacts with no address (separate plan).
- Updating Zoho CRM Leads' state field.
- Updating non-customer Zoho contacts (vendors, etc.).
- Continuous sync — this is one-shot cleanup. Going forward, the new-customer
  flow should set `cf_state` at creation time so we never have to do this again.
