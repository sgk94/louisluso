/**
 * Import contacts directly from a Google Sheet.
 *
 * Usage:
 *   pnpm email:import-sheets -- --sheet-id SHEET_ID [--range "Sheet1!A:E"] [--tag TAG]
 *
 * Expected columns (flexible header matching, same as CSV import):
 *   email (required), name, company, role, tags
 */
import { getSheetsClient } from "./gmail.ts";
import { addContacts, type Contact } from "./contacts.ts";
import "./env.ts";

function parseArgs(): { sheetId: string; range: string; tags: string[] } {
  const args = process.argv.slice(2);
  let sheetId = "";
  let range = "Sheet1";
  const tags: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--sheet-id":
        sheetId = args[++i];
        break;
      case "--range":
        range = args[++i];
        break;
      case "--tag":
        tags.push(args[++i]);
        break;
    }
  }

  if (!sheetId) {
    console.error(
      "Usage: pnpm email:import-sheets -- --sheet-id SHEET_ID [--range 'Sheet1!A:E'] [--tag TAG]"
    );
    process.exit(1);
  }

  return { sheetId, range, tags };
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h.toLowerCase().trim()));
}

async function main(): Promise<void> {
  const { sheetId, range, tags: tagOverride } = parseArgs();

  console.log(`Fetching sheet ${sheetId} (range: ${range})...`);

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) {
    console.log("No data found in sheet (need header row + at least 1 data row).");
    process.exit(0);
  }

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const emailIdx = findColumnIndex(headers, ["email", "e-mail"]);
  const nameIdx = findColumnIndex(headers, ["name", "contact"]);
  const companyIdx = findColumnIndex(headers, ["company", "business", "store"]);
  const typeIdx = findColumnIndex(headers, ["type", "segment"]);
  const roleIdx = findColumnIndex(headers, ["role", "title", "position"]);
  const locationIdx = findColumnIndex(headers, ["location", "city", "state", "region"]);
  const tagsIdx = findColumnIndex(headers, ["tags", "tag", "category"]);
  const sourceIdx = findColumnIndex(headers, ["source", "origin", "lead source"]);
  const notesIdx = findColumnIndex(headers, ["notes", "note", "comments"]);
  const statusIdx = findColumnIndex(headers, ["status"]);
  const emailCountIdx = findColumnIndex(headers, ["email count", "emailcount", "emails sent"]);
  const lastContactedIdx = findColumnIndex(headers, ["last contacted", "lastcontacted", "last email"]);

  if (emailIdx === -1) {
    console.error("Sheet must have an 'Email' column.");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const contacts: Contact[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const email = row[emailIdx]?.trim();
    if (!email || !email.includes("@")) continue;

    const sheetTags =
      tagsIdx !== -1 && row[tagsIdx]
        ? row[tagsIdx]
            .split(";")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];

    contacts.push({
      email,
      name: nameIdx !== -1 ? row[nameIdx]?.trim() ?? "" : "",
      company: companyIdx !== -1 ? row[companyIdx]?.trim() ?? "" : "",
      type: typeIdx !== -1 ? row[typeIdx]?.trim() ?? "" : "",
      role: roleIdx !== -1 ? row[roleIdx]?.trim() ?? "" : "",
      location: locationIdx !== -1 ? row[locationIdx]?.trim() ?? "" : "",
      tags: tagOverride.length > 0 ? tagOverride : sheetTags,
      source: sourceIdx !== -1 ? row[sourceIdx]?.trim() ?? "" : "",
      notes: notesIdx !== -1 ? row[notesIdx]?.trim() ?? "" : "",
      status: statusIdx !== -1 ? row[statusIdx]?.trim() ?? "new" : "new",
      emailCount: emailCountIdx !== -1 ? parseInt(row[emailCountIdx]?.trim() ?? "0", 10) || 0 : 0,
      lastContacted: lastContactedIdx !== -1 ? row[lastContactedIdx]?.trim() ?? "" : "",
      createdAt: now,
    });
  }

  if (contacts.length === 0) {
    console.log("No valid contacts found in sheet.");
    process.exit(0);
  }

  console.log(`Found ${contacts.length} contacts in sheet.`);

  const { added, skipped } = addContacts(contacts);
  console.log(`Added: ${added}, Skipped (duplicate): ${skipped}`);
}

main().catch((err) => {
  console.error("Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
