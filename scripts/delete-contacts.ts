/**
 * Hard-delete a list of Zoho Books contacts per Ken's request.
 * Preflights each (status, outstanding balance, invoice/order counts) and
 * refuses to delete if there's any transactional history — safety net.
 *
 * Dry-run by default. Pass --live to actually hit DELETE.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/delete-contacts.ts
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/delete-contacts.ts --live
 */
import "dotenv/config";
import { appendFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  deleteBooksContact,
  getAllBooksCustomers,
  getBooksContact,
  getInvoicesForContact,
  getSalesOrders,
} from "../lib/zoho/books.ts";

// Per Ken's request.
const TARGETS = [
  { label: "EYEDREAM EYECARE", email: "jeremiahkim@gmail.com" },
  { label: "Joynus (Eric Lee)", email: "aiden@joynus.com" },
  { label: "LOLKO LLC", email: "jy@lolkousa.com" },
  { label: "QSPEX", email: "MGRAHAM@QSPEX.COM" },
  { label: "OPTICAL AT LINCOLN GREEN", email: "thanhlan1001@yahoo.com" },
];

const OUT_DIR = "data/deletes";
const THROTTLE_MS = 1000;

async function main() {
  const live = process.argv.includes("--live");
  console.log(`Mode: ${live ? "LIVE (hard delete)" : "DRY RUN"}\n`);

  mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "");
  const logPath = join(OUT_DIR, `delete-log-${ts}.jsonl`);
  const backupPath = join(OUT_DIR, `backup-${ts}.json`);
  writeFileSync(logPath, "");

  const all = await getAllBooksCustomers();

  const backups: unknown[] = [];
  let ok = 0;
  let blocked = 0;
  let fail = 0;

  for (const t of TARGETS) {
    const match = all.find(
      (c) => ((c.email as string) ?? "").toLowerCase() === t.email.toLowerCase(),
    );
    if (!match) {
      console.log(`  [skip] ${t.label} — not found in Books`);
      appendFileSync(logPath, JSON.stringify({ label: t.label, status: "not-found" }) + "\n");
      continue;
    }
    const id = match.contact_id;
    const detail = await getBooksContact(id);
    const r = detail as Record<string, unknown>;
    const [invoices, orders] = await Promise.all([
      getInvoicesForContact(id),
      getSalesOrders(id),
    ]);
    const outstanding = Number(r.outstanding_receivable_amount ?? 0);

    // Snapshot full current state for rollback context (can't undo a hard delete,
    // but preserves every field we knew at delete time).
    backups.push({
      label: t.label,
      contact_id: id,
      deletedAt: new Date().toISOString(),
      detail,
    });

    console.log(`\n── ${t.label} (${id}) ──`);
    console.log(`  status:       ${detail.status}`);
    console.log(`  invoices:     ${invoices.length}`);
    console.log(`  sales orders: ${orders.length}`);
    console.log(`  outstanding:  ${outstanding}`);

    // Safety net: refuse to hard-delete if there's transactional history.
    if (invoices.length > 0 || orders.length > 0 || outstanding > 0) {
      console.log(`  [blocked] has transactional history — skipping`);
      appendFileSync(
        logPath,
        JSON.stringify({
          label: t.label,
          contact_id: id,
          status: "blocked",
          reason: "has transactions",
          invoices: invoices.length,
          orders: orders.length,
          outstanding,
        }) + "\n",
      );
      blocked++;
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
      continue;
    }

    if (!live) {
      console.log(`  [dry] would DELETE ${id}`);
      appendFileSync(
        logPath,
        JSON.stringify({ label: t.label, contact_id: id, status: "dry-run" }) + "\n",
      );
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
      continue;
    }

    try {
      await deleteBooksContact(id);
      console.log(`  [ok] deleted`);
      appendFileSync(
        logPath,
        JSON.stringify({ label: t.label, contact_id: id, status: "deleted" }) + "\n",
      );
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [err] ${msg}`);
      appendFileSync(
        logPath,
        JSON.stringify({ label: t.label, contact_id: id, status: "error", error: msg }) + "\n",
      );
      fail++;
    }

    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  writeFileSync(backupPath, JSON.stringify(backups, null, 2));
  console.log(
    `\nDone. ok=${ok} blocked=${blocked} fail=${fail}  log=${logPath}  backup=${backupPath}`,
  );
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
