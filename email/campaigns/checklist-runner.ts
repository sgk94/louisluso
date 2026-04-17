/**
 * Generic trip-campaign runner.
 *
 * Reads a markdown checklist file under data/email-campaign/ and sends every
 * unchecked row, flipping its checkbox to [x] on success and [!] on error.
 * Idempotent: already-sent rows are skipped.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config \
 *     email/campaigns/checklist-runner.ts data/email-campaign/2026-04-16-ga.md
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config \
 *     email/campaigns/checklist-runner.ts data/email-campaign/2026-04-16-ga.md --live
 *
 * Checklist format (must match the files under data/email-campaign/):
 *   ## First-touch (N to send) — template `trip-visit`
 *   Subject: `...`
 *   Area: `...`
 *   - [ ] Company — email@addr — greeting="Hi Name" — [area="override"] [notes]
 *
 * Status legend:
 *   [ ] pending   [x] sent   [!] error   [c] already contacted   [s] skipped   [i] inactive
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { sendEmail, verifyConnection } from "../send.ts";
import { env } from "../env.ts";

// Anti-spam cadence: 30s base delay + up to 15s jitter between sends.
// Gmail Workspace cap is 2000/day and ~1/sec rate, but bursting 60+ nearly-identical
// emails trips deliverability heuristics and reputation scoring. Slower cadence looks
// more like human-paced outreach.
const DELAY_BASE_MS = 30_000;
const DELAY_JITTER_MS = 15_000;

function delayMs(): number {
  return DELAY_BASE_MS + Math.floor(Math.random() * DELAY_JITTER_MS);
}

interface Section {
  template: string;
  subject: string;
  area: string;
  lineIndexes: number[]; // lines in the section (for scanning)
}

interface Row {
  lineIndex: number;
  status: string; // current checkbox char
  company: string;
  email: string;
  greeting: string;
  area: string;
  template: string;
  subject: string;
}

function parse(md: string): { lines: string[]; rows: Row[]; sections: Section[] } {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let cur: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tplMatch = line.match(/^##\s+.*template\s+`([^`]+)`/);
    if (tplMatch) {
      cur = { template: tplMatch[1], subject: "", area: "", lineIndexes: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;

    // New H2 without template tag ends the current section
    if (/^##\s+/.test(line) && !tplMatch) {
      cur = null;
      continue;
    }

    const subjectMatch = line.match(/^Subject:\s*`([^`]+)`/);
    if (subjectMatch) {
      cur.subject = subjectMatch[1];
      continue;
    }
    const areaMatch = line.match(/^Area:\s*`([^`]+)`/);
    if (areaMatch) {
      cur.area = areaMatch[1];
      continue;
    }
    cur.lineIndexes.push(i);
  }

  const rows: Row[] = [];
  for (const sec of sections) {
    for (const idx of sec.lineIndexes) {
      const line = lines[idx];
      const rowMatch = line.match(/^\s*-\s*\[([ xX!csi])\]\s*(.*)$/);
      if (!rowMatch) continue;
      const [, status, rest] = rowMatch;
      if (status.trim() !== "") continue; // only unchecked rows are candidates
      const email = extractEmail(rest);
      if (!email) continue;
      const greeting = extractQuoted(rest, "greeting") ?? "Hello";
      const rowArea = extractQuoted(rest, "area");
      const company = extractCompany(rest, email);
      rows.push({
        lineIndex: idx,
        status,
        company,
        email,
        greeting,
        area: rowArea ?? sec.area,
        template: sec.template,
        subject: sec.subject,
      });
    }
  }
  return { lines, rows, sections };
}

function extractEmail(s: string): string | null {
  const m = s.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
}

function extractQuoted(s: string, key: string): string | null {
  const m = s.match(new RegExp(`${key}="([^"]+)"`));
  return m ? m[1] : null;
}

function extractCompany(rowRest: string, email: string): string {
  // Everything before the email, trimmed of trailing " — "
  const beforeEmail = rowRest.split(email)[0] ?? rowRest;
  return beforeEmail.replace(/\s*—\s*$/, "").trim();
}

function flipCheckbox(line: string, to: string, suffix?: string): string {
  const replaced = line.replace(/\[\s?\]/, `[${to}]`);
  return suffix ? replaced + ` ${suffix}` : replaced;
}

async function main() {
  const live = process.argv.includes("--live");
  const path = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
  if (!path) {
    console.error("usage: checklist-runner.ts <path-to-checklist.md> [--live]");
    process.exit(1);
  }

  const md = readFileSync(path, "utf-8");
  const parsed = parse(md);
  let lines = parsed.lines;

  console.log(`Checklist: ${path}`);
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}  |  Pending: ${parsed.rows.length}  |  From: "${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`);

  if (parsed.rows.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  // Always verify the authenticated mailbox matches EMAIL_FROM_ADDRESS (even in dry-run).
  const ok = await verifyConnection();
  if (!ok) {
    console.error("Sender identity check failed — aborting.");
    process.exit(1);
  }

  const succeeded: Array<{ email: string; company: string }> = [];
  const failed: Array<{ email: string; company: string; error: string }> = [];

  for (const r of parsed.rows) {
    const vars = {
      greeting: r.greeting,
      company: r.company,
      area: r.area,
      dates: dateLabelFromSubject(r.subject),
    };

    if (!live) {
      console.log(`[dry] ${r.email}  ${r.company}  (${r.template})`);
      continue;
    }

    const res = await sendEmail({
      to: r.email,
      subject: r.subject,
      template: r.template,
      vars,
      contactName: r.greeting.replace(/^Hi\s+/, "").replace(/^Hello$/, ""),
      contactCompany: r.company,
      sequenceName: path.replace(/.*\//, "").replace(/\.md$/, ""),
      sequenceStep: 1,
    });

    if (res.success) {
      console.log(`✓ ${r.email}  ${r.company}`);
      lines[r.lineIndex] = flipCheckbox(lines[r.lineIndex], "x");
      writeFileSync(path, lines.join("\n"));
      succeeded.push({ email: r.email, company: r.company });
    } else {
      console.error(`✗ ${r.email}  ${r.company}  — ${res.error}`);
      lines[r.lineIndex] = flipCheckbox(
        lines[r.lineIndex],
        "!",
        `(error: ${String(res.error).replace(/\n/g, " ").slice(0, 200)})`,
      );
      writeFileSync(path, lines.join("\n"));
      failed.push({ email: r.email, company: r.company, error: String(res.error) });
    }

    await new Promise((r) => setTimeout(r, delayMs()));
  }

  if (!live) {
    console.log("\nDry run complete. Re-run with --live to actually send.");
    return;
  }

  console.log(`\n=== RESULTS: ${succeeded.length} sent, ${failed.length} failed ===`);
  if (succeeded.length > 0) {
    console.log("\nSUCCEEDED:");
    succeeded.forEach((s) => console.log(`  ✓ ${s.company} — ${s.email}`));
  }
  if (failed.length > 0) {
    console.log("\nFAILED (not retried):");
    failed.forEach((f) => console.log(`  ✗ ${f.company} — ${f.email}  [${f.error}]`));
  }
}

function dateLabelFromSubject(subject: string): string {
  // Pull "Apr 16-17" / "May 5-8" etc. from the subject line
  const m = subject.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+(?:-\d+)?/i);
  if (m) {
    return m[0].replace(/^Jan/i, "January")
      .replace(/^Feb/i, "February")
      .replace(/^Mar/i, "March")
      .replace(/^Apr/i, "April")
      .replace(/^May/i, "May")
      .replace(/^Jun/i, "June")
      .replace(/^Jul/i, "July")
      .replace(/^Aug/i, "August")
      .replace(/^Sep/i, "September")
      .replace(/^Oct/i, "October")
      .replace(/^Nov/i, "November")
      .replace(/^Dec/i, "December");
  }
  return "";
}

main().catch((e) => {
  console.error("Campaign failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
