/**
 * Re-bucket an existing preview JSON without re-fetching from Zoho.
 * Used after fixing the bucket logic in detect.ts.
 *
 *   npx tsx scripts/cf-state-fill/rebucket.ts data/cf-state-fill/preview-YYYY-MM-DD.json
 */
import { readFileSync, writeFileSync } from "fs";

type Bucket =
  | "fillable-both"
  | "fillable-state-only"
  | "fillable-city-only"
  | "no-source"
  | "unresolvable-state"
  | "would-overwrite";

interface Row {
  current_cf_state: string;
  current_cf_city: string;
  proposed_cf_state: string;
  proposed_cf_city: string;
  raw_state: string;
  source: "shipping" | "billing" | "none";
  bucket: Bucket;
  [k: string]: unknown;
}

function bucketFor(row: Row): Bucket {
  if (row.source === "none") return "no-source";
  const fillsState = !row.current_cf_state && !!row.proposed_cf_state;
  const fillsCity = !row.current_cf_city && !!row.proposed_cf_city;
  if (
    row.current_cf_state &&
    row.proposed_cf_state &&
    row.current_cf_state !== row.proposed_cf_state
  ) return "would-overwrite";
  if (fillsState && fillsCity) return "fillable-both";
  if (fillsState) return "fillable-state-only";
  if (fillsCity) return "fillable-city-only";
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

const path = process.argv[2];
if (!path) {
  console.error("usage: rebucket.ts <preview.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(path, "utf-8")) as {
  generatedAt: string;
  rows: Row[];
  counts?: Record<string, number>;
};

const counts: Record<Bucket, number> = {
  "fillable-both": 0,
  "fillable-state-only": 0,
  "fillable-city-only": 0,
  "no-source": 0,
  "unresolvable-state": 0,
  "would-overwrite": 0,
};
for (const r of data.rows) {
  r.bucket = bucketFor(r);
  counts[r.bucket]++;
}

writeFileSync(path, JSON.stringify({ ...data, counts }, null, 2));

const csvPath = path.replace(/\.json$/, ".csv");
const headers = [
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
for (const r of data.rows) {
  lines.push(headers.map((h) => csvEscape(String((r as Record<string, unknown>)[h] ?? ""))).join(","));
}
writeFileSync(csvPath, lines.join("\n") + "\n");

console.log("=== RE-BUCKETED ===");
for (const [b, n] of Object.entries(counts)) console.log(`  ${b.padEnd(22)} ${n}`);
console.log(`\nUpdated: ${path} + ${csvPath}`);
