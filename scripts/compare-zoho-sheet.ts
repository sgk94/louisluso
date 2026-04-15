/**
 * Compare Zoho Books customer contacts against a Google Sheet snapshot.
 * Reports: only-in-sheet, only-in-Zoho, and matched-but-differ.
 *
 * Usage:
 *   npx tsx scripts/compare-zoho-sheet.ts
 *     [--sheet-id ID] [--gid GID]
 *     [--out /tmp/zoho-sheet-diff.json]
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { zohoFetch } from "../lib/zoho/client.ts";
import { getSheetsClient } from "../email/gmail.ts";

const DEFAULT_SHEET_ID = "1bhFOCJLjtXLxE-f6MLupu_ERIRNdnwvxnZeDQEC8KUs";
const DEFAULT_GID = "1821798516";
const DEFAULT_OUT = "/tmp/zoho-sheet-diff.json";

interface SheetRow {
  companyName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
  rowIndex: number;
}

interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  billing_address?: { city?: string; state?: string };
  shipping_address?: { city?: string; state?: string };
  status: string;
  [key: string]: unknown;
}

interface ContactsPageResponse {
  contacts?: ZohoBooksContact[];
  page_context?: { has_more_page?: boolean; page?: number };
}

interface NormalizedRecord {
  source: "sheet" | "zoho";
  key: string;
  companyKey: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
  raw: SheetRow | ZohoBooksContact;
}

function parseArgs(): { sheetId: string; gid: string; outPath: string } {
  const args = process.argv.slice(2);
  let sheetId = DEFAULT_SHEET_ID;
  let gid = DEFAULT_GID;
  let outPath = DEFAULT_OUT;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--sheet-id":
        sheetId = args[++i] ?? sheetId;
        break;
      case "--gid":
        gid = args[++i] ?? gid;
        break;
      case "--out":
        outPath = args[++i] ?? outPath;
        break;
    }
  }
  return { sheetId, gid, outPath };
}

function normCompany(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function normEmail(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function normPhone(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

async function fetchSheet(sheetId: string, gid: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tab = (meta.data.sheets ?? []).find(
    (s) => String(s.properties?.sheetId) === String(gid),
  );
  if (!tab?.properties?.title) {
    throw new Error(`Tab gid=${gid} not found in sheet ${sheetId}`);
  }
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab.properties.title}'`,
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const idx = (name: string): number =>
    headers.findIndex((h) => h === name.toLowerCase());

  const companyIdx = idx("Company Name");
  const emailIdx = idx("EmailID");
  const phoneIdx = idx("Phone");
  const cityIdx = idx("Shipping City");
  const stateIdx = idx("Shipping State");
  const statusIdx = idx("Status");

  const out: SheetRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    out.push({
      companyName: String(row[companyIdx] ?? "").trim(),
      email: String(row[emailIdx] ?? "").trim(),
      phone: String(row[phoneIdx] ?? "").trim(),
      city: String(row[cityIdx] ?? "").trim(),
      state: String(row[stateIdx] ?? "").trim(),
      status: String(row[statusIdx] ?? "").trim(),
      rowIndex: i + 1, // 1-based, matches Sheets UI
    });
  }
  return out;
}

async function fetchZohoBooksCustomers(): Promise<ZohoBooksContact[]> {
  const all: ZohoBooksContact[] = [];
  let page = 1;
  while (true) {
    const res = await zohoFetch<ContactsPageResponse>("/books/v3/contacts", {
      params: {
        contact_type: "customer",
        page: String(page),
        per_page: "200",
      },
    });
    const batch = res.contacts ?? [];
    all.push(...batch);
    if (!res.page_context?.has_more_page) break;
    page += 1;
  }
  return all;
}

function buildKey(email: string, company: string): string {
  if (email) return `email:${normEmail(email)}`;
  return `company:${normCompany(company)}`;
}

async function main(): Promise<void> {
  const { sheetId, gid, outPath } = parseArgs();

  console.log("Fetching sheet...");
  const sheet = await fetchSheet(sheetId, gid);
  console.log(`  ${sheet.length} rows`);

  console.log("Fetching Zoho Books customers...");
  const zoho = await fetchZohoBooksCustomers();
  console.log(`  ${zoho.length} customers`);

  const sheetMap = new Map<string, NormalizedRecord>();
  for (const row of sheet) {
    const key = buildKey(row.email, row.companyName);
    const rec: NormalizedRecord = {
      source: "sheet",
      key,
      companyKey: normCompany(row.companyName),
      email: normEmail(row.email),
      phone: normPhone(row.phone),
      city: row.city.toLowerCase().trim(),
      state: row.state.toLowerCase().trim(),
      status: row.status.toLowerCase().trim(),
      raw: row,
    };
    // If duplicate key, keep first
    if (!sheetMap.has(key)) sheetMap.set(key, rec);
  }

  const zohoMap = new Map<string, NormalizedRecord>();
  for (const c of zoho) {
    const company = c.company_name || c.contact_name;
    const key = buildKey(c.email, company);
    const shipCity = c.shipping_address?.city ?? c.billing_address?.city ?? "";
    const shipState = c.shipping_address?.state ?? c.billing_address?.state ?? "";
    const rec: NormalizedRecord = {
      source: "zoho",
      key,
      companyKey: normCompany(company),
      email: normEmail(c.email),
      phone: normPhone(c.phone),
      city: shipCity.toLowerCase().trim(),
      state: shipState.toLowerCase().trim(),
      status: (c.status ?? "").toLowerCase().trim(),
      raw: c,
    };
    if (!zohoMap.has(key)) zohoMap.set(key, rec);
  }

  // Secondary company-name index to catch rows where the email is missing on
  // one side but company matches.
  const zohoByCompany = new Map<string, NormalizedRecord>();
  for (const z of zohoMap.values()) {
    if (z.companyKey && !zohoByCompany.has(z.companyKey)) {
      zohoByCompany.set(z.companyKey, z);
    }
  }
  const sheetByCompany = new Map<string, NormalizedRecord>();
  for (const s of sheetMap.values()) {
    if (s.companyKey && !sheetByCompany.has(s.companyKey)) {
      sheetByCompany.set(s.companyKey, s);
    }
  }

  const onlyInSheet: NormalizedRecord[] = [];
  const onlyInZoho: NormalizedRecord[] = [];
  const diffs: Array<{ sheet: NormalizedRecord; zoho: NormalizedRecord; fields: string[] }> = [];
  const matched: Array<{ sheet: NormalizedRecord; zoho: NormalizedRecord }> = [];

  const matchedKeys = new Set<string>();

  for (const s of sheetMap.values()) {
    let z = zohoMap.get(s.key);
    if (!z && s.companyKey) z = zohoByCompany.get(s.companyKey);

    if (!z) {
      onlyInSheet.push(s);
      continue;
    }

    matchedKeys.add(z.key);

    const fields: string[] = [];
    if (s.email && z.email && s.email !== z.email) fields.push("email");
    if (s.phone && z.phone && s.phone !== z.phone) fields.push("phone");
    if (s.companyKey !== z.companyKey) fields.push("company");
    if (s.city && z.city && s.city !== z.city) fields.push("city");
    if (s.state && z.state && s.state !== z.state) fields.push("state");
    if (s.status && z.status && s.status !== z.status) fields.push("status");
    if (!s.email && z.email) fields.push("email-missing-in-sheet");
    if (s.email && !z.email) fields.push("email-missing-in-zoho");

    if (fields.length > 0) diffs.push({ sheet: s, zoho: z, fields });
    else matched.push({ sheet: s, zoho: z });
  }

  for (const z of zohoMap.values()) {
    if (matchedKeys.has(z.key)) continue;
    if (z.companyKey && sheetByCompany.has(z.companyKey)) continue; // already matched via company
    onlyInZoho.push(z);
  }

  const summary = {
    counts: {
      sheetRows: sheet.length,
      zohoCustomers: zoho.length,
      matchedExact: matched.length,
      matchedWithDiffs: diffs.length,
      onlyInSheet: onlyInSheet.length,
      onlyInZoho: onlyInZoho.length,
    },
    diffsByField: diffs.reduce<Record<string, number>>((acc, d) => {
      for (const f of d.fields) acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {}),
  };

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  const report = {
    summary,
    onlyInSheet: onlyInSheet.map((r) => r.raw),
    onlyInZoho: onlyInZoho.map((r) => ({
      contact_id: (r.raw as ZohoBooksContact).contact_id,
      company_name: (r.raw as ZohoBooksContact).company_name,
      contact_name: (r.raw as ZohoBooksContact).contact_name,
      email: (r.raw as ZohoBooksContact).email,
      phone: (r.raw as ZohoBooksContact).phone,
      status: (r.raw as ZohoBooksContact).status,
      city: r.city,
      state: r.state,
    })),
    diffs: diffs.map((d) => ({
      fields: d.fields,
      sheet: d.sheet.raw,
      zoho: {
        contact_id: (d.zoho.raw as ZohoBooksContact).contact_id,
        company_name: (d.zoho.raw as ZohoBooksContact).company_name,
        contact_name: (d.zoho.raw as ZohoBooksContact).contact_name,
        email: (d.zoho.raw as ZohoBooksContact).email,
        phone: (d.zoho.raw as ZohoBooksContact).phone,
        status: (d.zoho.raw as ZohoBooksContact).status,
        city: d.zoho.city,
        state: d.zoho.state,
      },
    })),
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report: ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
