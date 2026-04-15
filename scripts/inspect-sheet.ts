/**
 * Inspect a Google Sheet tab. Resolves gid -> sheet name, prints headers + sample rows.
 * Usage: npx tsx scripts/inspect-sheet.ts <sheetId> <gid>
 */
import "dotenv/config";
import { getSheetsClient } from "../email/gmail.ts";

const sheetId = process.argv[2];
const gid = process.argv[3];

if (!sheetId || !gid) {
  console.error("Usage: npx tsx scripts/inspect-sheet.ts <sheetId> <gid>");
  process.exit(1);
}

async function main(): Promise<void> {
  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tab = (meta.data.sheets ?? []).find(
    (s) => String(s.properties?.sheetId) === String(gid),
  );

  if (!tab?.properties?.title) {
    console.error(`No tab with gid=${gid}. Available tabs:`);
    for (const s of meta.data.sheets ?? []) {
      console.error(`  gid=${s.properties?.sheetId}  name="${s.properties?.title}"`);
    }
    process.exit(1);
  }

  const title = tab.properties.title;
  console.log(`Tab gid=${gid} => "${title}"`);
  console.log(`Other tabs in workbook:`);
  for (const s of meta.data.sheets ?? []) {
    console.log(`  - "${s.properties?.title}" (gid=${s.properties?.sheetId})`);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${title}'`,
  });

  const rows = res.data.values ?? [];
  console.log(`\nTab "${title}" has ${rows.length} rows total.`);

  if (rows.length === 0) return;

  console.log(`\nHeaders (row 1):`);
  console.log(rows[0]);

  console.log(`\nSample rows (up to 5):`);
  for (let i = 1; i < Math.min(rows.length, 6); i++) {
    console.log(`  row ${i}:`, rows[i]);
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
