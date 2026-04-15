/**
 * Apply approved cf_state / cf_city fills to Zoho Books.
 * Source: data/cf-state-fill/approved.csv (produced from preview-*.csv after Shawn review).
 * Default = dry-run. Pass --live to actually PUT.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/cf-state-fill/apply.ts
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/cf-state-fill/apply.ts --live
 *
 * HARD CONSTRAINT (per plan): only cf_state and cf_city are written. Any
 * approved-CSV row whose `field` column targets anything else makes the
 * script exit non-zero before any network call. The PUT patch always
 * contains exactly one key: `custom_fields`.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import {
  getBooksContact,
  updateBooksContact,
  type BooksContactPatch,
  type BooksCustomFieldPatch,
} from "../../lib/zoho/books.ts";

const APPROVED_PATH = process.env.APPROVED_PATH ?? "data/cf-state-fill/approved.csv";
const OUT_DIR = "data/cf-state-fill";
const THROTTLE_MS = 1000;

const ALLOWED_FIELDS = new Set(["cf_state", "cf_city"]);

interface ApprovedRow {
  contact_id: string;
  proposed_cf_state: string;
  proposed_cf_city: string;
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

function parseCsv(text: string): ApprovedRow[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const idIdx = headers.indexOf("contact_id");
  const stateIdx = headers.indexOf("proposed_cf_state");
  const cityIdx = headers.indexOf("proposed_cf_city");
  if (idIdx < 0 || stateIdx < 0 || cityIdx < 0) {
    throw new Error(
      `CSV missing required columns. Need: contact_id, proposed_cf_state, proposed_cf_city. Got: ${headers.join(", ")}`,
    );
  }

  // Defensive: if the CSV happens to carry a `field` column from some other
  // pipeline, refuse anything outside cf_state / cf_city.
  const fieldIdx = headers.indexOf("field");

  const out: ApprovedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (fieldIdx >= 0) {
      const f = (cols[fieldIdx] ?? "").trim();
      if (f && !ALLOWED_FIELDS.has(f)) {
        throw new Error(
          `Approved CSV row ${i + 1} targets disallowed field "${f}". Only cf_state and cf_city are writable.`,
        );
      }
    }
    const id = (cols[idIdx] ?? "").trim();
    if (!id) continue;
    out.push({
      contact_id: id,
      proposed_cf_state: (cols[stateIdx] ?? "").trim(),
      proposed_cf_city: (cols[cityIdx] ?? "").trim(),
    });
  }
  return out;
}

function buildPatch(row: ApprovedRow): BooksContactPatch | null {
  const cfs: BooksCustomFieldPatch[] = [];
  if (row.proposed_cf_state) cfs.push({ api_name: "cf_state", value: row.proposed_cf_state });
  if (row.proposed_cf_city) cfs.push({ api_name: "cf_city", value: row.proposed_cf_city });
  if (cfs.length === 0) return null;
  return { custom_fields: cfs };
}

async function snapshotBackup(rows: ApprovedRow[], path: string): Promise<void> {
  console.log(`Snapshotting ${rows.length} contacts → ${path}`);
  const snaps: Array<{
    contact_id: string;
    cf_state: string;
    cf_city: string;
    contact_name: string;
  }> = [];
  let i = 0;
  for (const r of rows) {
    i++;
    if (i % 25 === 0) console.log(`  backup ...${i}/${rows.length}`);
    try {
      const c = await getBooksContact(r.contact_id);
      snaps.push({
        contact_id: r.contact_id,
        cf_state: String((c as Record<string, unknown>).cf_state ?? ""),
        cf_city: String((c as Record<string, unknown>).cf_city ?? ""),
        contact_name: c.contact_name ?? "",
      });
    } catch (err) {
      snaps.push({
        contact_id: r.contact_id,
        cf_state: "",
        cf_city: "",
        contact_name: `(backup-failed: ${err instanceof Error ? err.message : String(err)})`,
      });
    }
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), snaps }, null, 2));
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");

  if (!existsSync(APPROVED_PATH)) {
    console.error(`Missing ${APPROVED_PATH}. Complete Phase 4 (CSV approval) first.`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(APPROVED_PATH, "utf-8"));
  console.log(`Approved rows: ${rows.length}`);
  console.log(`Mode: ${live ? "LIVE (will PUT to Zoho)" : "DRY RUN (no writes)"}`);

  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "");
  const logPath = join(OUT_DIR, `apply-log-${ts}.jsonl`);
  writeFileSync(logPath, "");

  if (live) {
    const backupPath = join(OUT_DIR, `backup-${ts}.json`);
    await snapshotBackup(rows, backupPath);
    console.log(`Backup written → ${backupPath}\n`);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const r of rows) {
    const patch = buildPatch(r);
    const entry = {
      ts: new Date().toISOString(),
      contact_id: r.contact_id,
      patch,
      mode: live ? "live" : "dry-run",
    };

    if (!patch) {
      console.log(`  [skip] ${r.contact_id} — nothing to write`);
      appendFileSync(logPath, JSON.stringify({ ...entry, status: "skipped-empty" }) + "\n");
      skip++;
      continue;
    }

    if (!live) {
      console.log(`  [dry] ${r.contact_id} ← ${JSON.stringify(patch)}`);
      appendFileSync(logPath, JSON.stringify({ ...entry, status: "skipped-dryrun" }) + "\n");
      continue;
    }

    try {
      await updateBooksContact(r.contact_id, patch);
      console.log(`  [ok]  ${r.contact_id}`);
      appendFileSync(logPath, JSON.stringify({ ...entry, status: "ok" }) + "\n");
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [err] ${r.contact_id}: ${msg}`);
      appendFileSync(logPath, JSON.stringify({ ...entry, status: "error", error: msg }) + "\n");
      fail++;
    }

    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}  log=${logPath}`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
