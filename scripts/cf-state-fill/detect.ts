/**
 * Detect Zoho Books customers missing cf_state / cf_city and derive the
 * proposed values from each contact's existing shipping_address (→ billing
 * fallback). Read-only: emits preview JSON + CSV under data/cf-state-fill/.
 *
 * Source of truth for state/city = data Zoho already has on the contact.
 * The frozen Google Sheet is intentionally NOT consulted here.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/cf-state-fill/detect.ts
 *     [--limit N]   # optional: stop after N per-contact GETs (for spot-check runs)
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getAllBooksCustomers,
  getBooksContact,
  type ZohoBooksContact,
} from "../../lib/zoho/books.ts";
import { toStateCode } from "./state-codes.ts";

const OUT_DIR = "data/cf-state-fill";
const THROTTLE_MS = 1000;

type Bucket =
  | "fillable-both"
  | "fillable-state-only"
  | "fillable-city-only"
  | "no-source"
  | "unresolvable-state"
  | "would-overwrite";

interface Row {
  contact_id: string;
  contact_name: string;
  company_name: string;
  current_cf_state: string;
  current_cf_city: string;
  proposed_cf_state: string;
  proposed_cf_city: string;
  source: "shipping" | "billing" | "none";
  raw_state: string;
  country: string;
  bucket: Bucket;
}

function parseArgs(): { limit: number | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") {
      const n = Number(args[++i]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { limit };
}

function readField(c: ZohoBooksContact, key: string): string {
  const v = (c as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

function pickAddress(
  c: ZohoBooksContact,
): { source: "shipping" | "billing" | "none"; state: string; city: string; country: string } {
  const ship = c.shipping_address;
  const bill = c.billing_address;
  const shipState = (ship?.state ?? "").trim();
  const shipCity = (ship?.city ?? "").trim();
  if (shipState || shipCity) {
    return {
      source: "shipping",
      state: shipState,
      city: shipCity,
      country: (ship?.country ?? "").trim(),
    };
  }
  const billState = (bill?.state ?? "").trim();
  const billCity = (bill?.city ?? "").trim();
  if (billState || billCity) {
    return {
      source: "billing",
      state: billState,
      city: billCity,
      country: (bill?.country ?? "").trim(),
    };
  }
  return { source: "none", state: "", city: "", country: "" };
}

function bucketFor(row: {
  current_cf_state: string;
  current_cf_city: string;
  proposed_cf_state: string;
  proposed_cf_city: string;
  raw_state: string;
  source: "shipping" | "billing" | "none";
}): Bucket {
  if (row.source === "none") return "no-source";

  const fillsState = !row.current_cf_state && !!row.proposed_cf_state;
  const fillsCity = !row.current_cf_city && !!row.proposed_cf_city;

  // Defensive: should never trigger because we set proposed_cf_state="" when
  // current_cf_state is already populated, but keep the safety check.
  if (
    row.current_cf_state &&
    row.proposed_cf_state &&
    row.current_cf_state !== row.proposed_cf_state
  ) {
    return "would-overwrite";
  }

  if (fillsState && fillsCity) return "fillable-both";
  if (fillsState) return "fillable-state-only";
  if (fillsCity) return "fillable-city-only";

  // Nothing to fill from this row.
  // - State was already populated (we honored D5: never overwrite). City was either
  //   already populated too, or no city was found.
  // - OR state was blank, address has a state value, but our normalizer rejected
  //   it (foreign country, garbage, etc.). That's the only true "unresolvable".
  if (!row.current_cf_state && row.raw_state && !row.proposed_cf_state) {
    return "unresolvable-state";
  }
  return "no-source";
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCsv(rows: Row[]): string {
  const headers: (keyof Row)[] = [
    "contact_id",
    "contact_name",
    "company_name",
    "current_cf_state",
    "current_cf_city",
    "proposed_cf_state",
    "proposed_cf_city",
    "source",
    "raw_state",
    "country",
    "bucket",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(String(r[h] ?? ""))).join(","));
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  const { limit } = parseArgs();

  console.log("Listing Zoho Books customers...");
  const all = await getAllBooksCustomers();
  console.log(`  ${all.length} total`);

  const targets = all.filter((c) => {
    const s = readField(c, "cf_state");
    const ct = readField(c, "cf_city");
    return !s || !ct;
  });
  console.log(`  ${targets.length} missing cf_state and/or cf_city`);

  const slice = limit ? targets.slice(0, limit) : targets;
  console.log(`  fetching detail for ${slice.length} contacts (throttle ${THROTTLE_MS}ms)`);

  const rows: Row[] = [];
  let i = 0;
  for (const c of slice) {
    i++;
    if (i % 25 === 0) console.log(`    ...${i}/${slice.length}`);
    let detail: ZohoBooksContact;
    try {
      detail = await getBooksContact(c.contact_id);
    } catch (err) {
      console.error(`    [err] ${c.contact_id}: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
      continue;
    }

    const currentState = readField(detail, "cf_state");
    const currentCity = readField(detail, "cf_city");
    const addr = pickAddress(detail);
    const proposedState = toStateCode(addr.state, addr.country) ?? "";
    const proposedCity = addr.city.trim().replace(/\s+/g, " ").toUpperCase();

    const row: Row = {
      contact_id: detail.contact_id,
      contact_name: detail.contact_name ?? "",
      company_name: detail.company_name ?? "",
      current_cf_state: currentState,
      current_cf_city: currentCity,
      proposed_cf_state: currentState ? "" : proposedState, // never overwrite (D5)
      proposed_cf_city: currentCity ? "" : proposedCity,    // never overwrite
      source: addr.source,
      raw_state: addr.state,
      country: addr.country,
      bucket: "no-source",
    };
    row.bucket = bucketFor(row);
    rows.push(row);

    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  // Summary
  const counts: Record<Bucket, number> = {
    "fillable-both": 0,
    "fillable-state-only": 0,
    "fillable-city-only": 0,
    "no-source": 0,
    "unresolvable-state": 0,
    "would-overwrite": 0,
  };
  for (const r of rows) counts[r.bucket]++;

  const stateHist = new Map<string, number>();
  const cityHist = new Map<string, number>();
  for (const r of rows) {
    if (r.proposed_cf_state) stateHist.set(r.proposed_cf_state, (stateHist.get(r.proposed_cf_state) ?? 0) + 1);
    if (r.proposed_cf_city) cityHist.set(r.proposed_cf_city, (cityHist.get(r.proposed_cf_city) ?? 0) + 1);
  }

  console.log("\n=== BUCKETS ===");
  for (const [b, n] of Object.entries(counts)) console.log(`  ${b.padEnd(22)} ${n}`);

  console.log("\n=== TOP 15 PROPOSED STATES ===");
  [...stateHist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)} | ${k}`));

  console.log("\n=== TOP 20 PROPOSED CITIES ===");
  [...cityHist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)} | ${k}`));

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = join(OUT_DIR, `preview-${stamp}.json`);
  const csvPath = join(OUT_DIR, `preview-${stamp}.csv`);
  writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), counts, rows }, null, 2),
  );
  writeFileSync(csvPath, toCsv(rows));
  console.log(`\n  JSON: ${jsonPath}`);
  console.log(`  CSV:  ${csvPath}`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
