import "dotenv/config";
import { getSheetsClient } from "../email/gmail.js";
import { createLead, type CRMLeadInput } from "../lib/zoho/crm.js";
import { matchRegion, lookupCity, updateKnowledgeBase } from "../lib/crm/regions.js";

const SHEET_ID = "1xWFgNlWI0GKnwPJ-btI9Yx9MaWaEwx42P-gQWnxQwpw";
const SHEET_RANGE = "Sheet1!A:P";

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
    state: parsed.state ?? "",
    city: parsed.city ?? "",
    zip: parsed.zip ?? "",
  };
}

function enrichLocation(contact: CardContact): { state: string; city: string; zip: string; region: string | null } {
  let { state, city, zip } = contact;

  // If we have city + state but no zip, try the knowledge base
  if (city && state && !zip) {
    const known = lookupCity(city, state);
    if (known) {
      zip = known.zip;
      console.log(`KB: resolved ${city}, ${state} → zip ${zip}`);
    }
  }

  // Auto-assign region from zip
  const region = matchRegion(zip);

  return { state, city, zip, region };
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function writeToZohoCRM(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null }): Promise<string> {
  const { first, last } = splitName(contact.name);

  const leadInput: CRMLeadInput = {
    Company: contact.company || "Unknown",
    First_Name: first,
    Last_Name: last || first, // Zoho requires Last_Name
    Email: contact.email,
    Phone: contact.phone,
    Street: contact.address,
    City: location.city,
    State: location.state,
    Zip_Code: location.zip,
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
  console.log(`CRM: created lead ${leadId} for ${contact.name} (${contact.email})`);
  return leadId;
}

async function appendToSheet(contact: CardContact, location: { state: string; city: string; zip: string; region: string | null }): Promise<void> {
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
    location.region ?? "",  // Region (new column P)
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  console.log(`Sheet: appended row for ${contact.name} (${contact.email})`);
}

async function main(): Promise<void> {
  const contact = parseArgs();

  if (!contact.email) {
    console.error("Error: email is required");
    process.exit(1);
  }

  // Enrich location from knowledge base
  const location = enrichLocation(contact);

  if (location.region) {
    console.log(`Region: ${location.region}`);
  } else {
    console.log("Region: none (no matching zip prefix)");
  }

  // Write to Zoho CRM (primary)
  await writeToZohoCRM(contact, location);

  // Append to Google Sheet (Ken's readable view)
  await appendToSheet(contact, location);

  // Update knowledge base if we have city + state + zip
  if (location.city && location.state && location.zip) {
    updateKnowledgeBase(location.city, location.state, location.zip, location.region);
    console.log(`KB: saved ${location.city}, ${location.state} → ${location.zip} (${location.region ?? "no region"})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
