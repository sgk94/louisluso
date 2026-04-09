import "dotenv/config";
import { getSheetsClient } from "../email/gmail.js";
import { loadContacts, saveContacts, type Contact } from "../email/contacts.js";

const SHEET_ID = "1xWFgNlWI0GKnwPJ-btI9Yx9MaWaEwx42P-gQWnxQwpw";
const SHEET_RANGE = "Sheet1!A:O";

interface CardContact {
  name: string;
  email: string;
  company: string;
  type: string;
  role: string;
  location: string;
  tags: string[];
  source: string;
  notes: string;
  phone: string;
  website: string;
  address: string;
}

function parseArgs(): CardContact {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: npx tsx scripts/append-contact.ts '<JSON>'");
    process.exit(1);
  }
  const parsed = JSON.parse(raw) as Partial<CardContact>;
  return {
    name: parsed.name ?? "",
    email: parsed.email ?? "",
    company: parsed.company ?? "",
    type: parsed.type ?? "",
    role: parsed.role ?? "",
    location: parsed.location ?? "",
    tags: parsed.tags ?? ["business-card"],
    source: parsed.source ?? "business-card",
    notes: parsed.notes ?? "",
    phone: parsed.phone ?? "",
    website: parsed.website ?? "",
    address: parsed.address ?? "",
  };
}

async function appendToSheet(contact: CardContact): Promise<void> {
  const sheets = getSheetsClient();
  const now = new Date().toISOString().split("T")[0];
  const row = [
    contact.name,
    contact.email,
    contact.company,
    contact.type,
    contact.role,
    contact.location,
    contact.tags.join(";"),
    contact.source,
    contact.notes,
    "new",          // Status
    "0",            // Email Count
    "",             // Last Contacted
    contact.phone,
    contact.website,
    contact.address,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  console.log(`Sheet: appended row for ${contact.name} (${contact.email})`);
}

function addToContacts(contact: CardContact): void {
  const existing = loadContacts();
  const emailLower = contact.email.toLowerCase().trim();

  if (existing.some((c) => c.email.toLowerCase() === emailLower)) {
    console.log(`Contacts: skipped ${contact.email} (already exists)`);
    return;
  }

  const now = new Date().toISOString();
  const newContact: Contact = {
    email: emailLower,
    name: contact.name,
    company: contact.company,
    type: contact.type,
    role: contact.role,
    location: contact.location,
    tags: contact.tags,
    source: contact.source,
    notes: [
      contact.notes,
      contact.phone ? `Phone: ${contact.phone}` : "",
      contact.website ? `Website: ${contact.website}` : "",
      contact.address ? `Address: ${contact.address}` : "",
    ].filter(Boolean).join(" | "),
    status: "new",
    emailCount: 0,
    lastContacted: "",
    createdAt: now,
  };

  existing.push(newContact);
  saveContacts(existing);
  console.log(`Contacts: added ${contact.name} (${contact.email})`);
}

async function main(): Promise<void> {
  const contact = parseArgs();

  if (!contact.email) {
    console.error("Error: email is required");
    process.exit(1);
  }

  await appendToSheet(contact);
  addToContacts(contact);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
