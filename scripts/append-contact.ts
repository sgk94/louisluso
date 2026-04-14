import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { getSheetsClient } from "../email/gmail.js";
import { createLead, type CRMLeadInput } from "../lib/zoho/crm.js";
import { matchRegion, lookupCity, updateKnowledgeBase } from "../lib/crm/regions.js";

const SHEET_ID = process.env.CONTACTS_SHEET_ID ?? "1xWFgNlWI0GKnwPJ-btI9Yx9MaWaEwx42P-gQWnxQwpw";
const SHEET_RANGE = "Sheet1!A:Q";
const BATCH_DELAY_MS = 2000;

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
  state: string;
  city: string;
  zip: string;
  country: string;
}

function normalizeContact(parsed: Partial<CardContact>): CardContact {
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
    state: parsed.state ?? "",
    city: parsed.city ?? "",
    zip: parsed.zip ?? "",
    country: parsed.country ?? "",
  };
}

const CA_PROVINCES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

function detectCountry(state: string, zip: string): string {
  if (/^[A-Za-z]\d[A-Za-z]/.test(zip)) return "Canada";
  if (CA_PROVINCES.has(state.toUpperCase().trim())) return "Canada";
  if (/^\d{5}/.test(zip)) return "United States";
  if (/^[A-Z]{2}$/.test(state.toUpperCase().trim()) && !CA_PROVINCES.has(state.toUpperCase().trim())) return "United States";
  return "";
}

function enrichLocation(contact: CardContact): { state: string; city: string; zip: string; region: string | null; country: string } {
  let { state, city, zip, country } = contact;

  if (city && state && !zip) {
    const known = lookupCity(city, state);
    if (known) {
      zip = known.zip;
      console.log(`  KB: resolved ${city}, ${state} → zip ${zip}`);
    }
  }

  if (!country) {
    country = detectCountry(state, zip);
    if (country) console.log(`  Country: auto-detected ${country}`);
  }

  const region = matchRegion(zip);

  return { state, city, zip, region, country };
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function writeToZohoCRM(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null; country: string }): Promise<string> {
  const { first, last } = splitName(contact.name);

  const leadInput: CRMLeadInput = {
    Company: contact.company || "Unknown",
    First_Name: first,
    Last_Name: last || first,
    Email: contact.email || undefined,
    Phone: contact.phone || undefined,
    Street: contact.address || undefined,
    City: location.city,
    State: location.state,
    Zip_Code: location.zip,
    Country: location.country || undefined,
    Region: location.region ?? undefined,
    Lead_Source: contact.source === "business-card" ? "Business Card" : contact.source,
    Description: [
      contact.role ? `Role: ${contact.role}` : "",
      contact.type ? `Type: ${contact.type}` : "",
      contact.website ? `Website: ${contact.website}` : "",
      contact.notes,
    ].filter(Boolean).join(" | "),
  };

  const leadId = await createLead(leadInput);
  return leadId;
}

async function appendToSheet(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null; country: string }): Promise<void> {
  const sheets = getSheetsClient();
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
    "new",
    "0",
    "",
    contact.phone,
    contact.website,
    contact.address,
    location.region ?? "",
    location.country,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

async function processContact(contact: CardContact, index?: number): Promise<boolean> {
  const label = index !== undefined ? `[${index + 1}] ` : "";

  console.log(`${label}${contact.name} (${contact.email || "no email"})`);

  if (!contact.email) {
    console.log(`  Warning: no email — CRM + Sheet only`);
  }

  const location = enrichLocation(contact);
  console.log(`  Region: ${location.region ?? "none"}`);

  let leadId: string;
  try {
    leadId = await writeToZohoCRM(contact, location);
    console.log(`  CRM: lead ${leadId}`);
  } catch (err) {
    console.error(`  CRM FAILED: ${err instanceof Error ? err.message : err}`);
    return false;
  }

  try {
    await appendToSheet(contact, location);
    console.log(`  Sheet: appended`);
  } catch (err) {
    console.error(`  Sheet FAILED (CRM lead ${leadId} already created): ${err instanceof Error ? err.message : err}`);
  }

  if (location.city && location.state && location.zip) {
    updateKnowledgeBase(location.city, location.state, location.zip, location.region);
  }

  console.log(`  Done.`);
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Batch mode: --batch <file.json> [--resume]
  if (args[0] === "--batch") {
    const filePath = args[1];
    if (!filePath) {
      console.error("Usage: npx tsx scripts/append-contact.ts --batch <contacts.json> [--resume]");
      process.exit(1);
    }

    const resume = args.includes("--resume");
    const checkpointPath = filePath.replace(/\.json$/, "") + ".checkpoint.json";

    const raw = readFileSync(filePath, "utf-8");
    const contacts = (JSON.parse(raw) as Partial<CardContact>[]).map(normalizeContact);

    // Load checkpoint if resuming
    let processed = new Set<number>();
    if (resume && existsSync(checkpointPath)) {
      const cp = JSON.parse(readFileSync(checkpointPath, "utf-8")) as number[];
      processed = new Set(cp);
      console.log(`Resuming: ${processed.size} contacts already processed, skipping those\n`);
    }

    console.log(`Batch processing ${contacts.length} contacts (${BATCH_DELAY_MS}ms delay between each)\n`);

    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < contacts.length; i++) {
      if (processed.has(i)) {
        skipped++;
        continue;
      }

      const ok = await processContact(contacts[i], i);
      if (ok) {
        success++;
        processed.add(i);
        // Save checkpoint after each success
        writeFileSync(checkpointPath, JSON.stringify([...processed]) + "\n");
      } else {
        failed++;
      }

      // Delay between contacts to avoid Zoho rate limiting
      if (i < contacts.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`\nBatch complete: ${success} succeeded, ${failed} failed, ${skipped} skipped (resumed) out of ${contacts.length}`);

    // Clean up checkpoint if everything succeeded
    if (failed === 0 && existsSync(checkpointPath)) {
      unlinkSync(checkpointPath);
      console.log("Checkpoint file removed (all contacts processed).");
    } else if (failed > 0) {
      console.log(`Checkpoint saved to ${checkpointPath} — re-run with --resume to retry failed contacts.`);
    }
    return;
  }

  // Single mode: '<JSON>'
  const raw = args[0];
  if (!raw) {
    console.error("Usage:");
    console.error("  Single: npx tsx scripts/append-contact.ts '<JSON>'");
    console.error("  Batch:  npx tsx scripts/append-contact.ts --batch <contacts.json>");
    process.exit(1);
  }

  const contact = normalizeContact(JSON.parse(raw) as Partial<CardContact>);
  const ok = await processContact(contact);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
