import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const CONTACTS_PATH = join(__dir, "contacts.json");

export interface Contact {
  email: string;
  name: string;
  company: string;
  type: string;
  role: string;
  location: string;
  tags: string[];
  source: string;
  notes: string;
  status: string;
  emailCount: number;
  lastContacted: string;
  createdAt: string;
}

export function loadContacts(): Contact[] {
  if (!existsSync(CONTACTS_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(CONTACTS_PATH, "utf-8")) as Contact[];
}

export function saveContacts(contacts: Contact[]): void {
  writeFileSync(CONTACTS_PATH, JSON.stringify(contacts, null, 2) + "\n");
}

export function addContacts(newContacts: Contact[]): { added: number; skipped: number } {
  const existing = loadContacts();
  const existingEmails = new Set(existing.map((c) => c.email.toLowerCase()));
  let added = 0;
  let skipped = 0;

  for (const contact of newContacts) {
    const email = contact.email.toLowerCase().trim();
    if (existingEmails.has(email)) {
      skipped++;
      continue;
    }
    existingEmails.add(email);
    existing.push({ ...contact, email });
    added++;
  }

  saveContacts(existing);
  return { added, skipped };
}

export function getContactsByTag(tag: string): Contact[] {
  return loadContacts().filter((c) => c.tags.includes(tag));
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const contact of loadContacts()) {
    for (const tag of contact.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function parseCSV(csvContent: string, tagOverride?: string[]): Contact[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = headers.findIndex((h) => h === "email" || h === "e-mail");
  const nameIdx = headers.findIndex((h) => h === "name" || h === "contact");
  const companyIdx = headers.findIndex((h) => h === "company" || h === "business" || h === "store");
  const typeIdx = headers.findIndex((h) => h === "type" || h === "segment");
  const roleIdx = headers.findIndex((h) => h === "role" || h === "title" || h === "position");
  const locationIdx = headers.findIndex((h) => h === "location" || h === "city" || h === "state" || h === "region");
  const tagsIdx = headers.findIndex((h) => h === "tags" || h === "tag" || h === "category");
  const sourceIdx = headers.findIndex((h) => h === "source" || h === "origin" || h === "lead source");
  const notesIdx = headers.findIndex((h) => h === "notes" || h === "note" || h === "comments");
  const statusIdx = headers.findIndex((h) => h === "status");
  const emailCountIdx = headers.findIndex((h) => h === "email count" || h === "emailcount" || h === "emails sent");
  const lastContactedIdx = headers.findIndex((h) => h === "last contacted" || h === "lastcontacted" || h === "last email");

  if (emailIdx === -1) {
    throw new Error("CSV must have an 'email' column");
  }

  const contacts: Contact[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const email = cols[emailIdx]?.trim();
    if (!email || !email.includes("@")) continue;

    const csvTags = tagsIdx !== -1 && cols[tagsIdx]
      ? cols[tagsIdx].split(";").map((t) => t.trim()).filter(Boolean)
      : [];
    const tags = tagOverride ?? csvTags;

    contacts.push({
      email,
      name: nameIdx !== -1 ? cols[nameIdx]?.trim() ?? "" : "",
      company: companyIdx !== -1 ? cols[companyIdx]?.trim() ?? "" : "",
      type: typeIdx !== -1 ? cols[typeIdx]?.trim() ?? "" : "",
      role: roleIdx !== -1 ? cols[roleIdx]?.trim() ?? "" : "",
      location: locationIdx !== -1 ? cols[locationIdx]?.trim() ?? "" : "",
      tags,
      source: sourceIdx !== -1 ? cols[sourceIdx]?.trim() ?? "" : "",
      notes: notesIdx !== -1 ? cols[notesIdx]?.trim() ?? "" : "",
      status: statusIdx !== -1 ? cols[statusIdx]?.trim() ?? "new" : "new",
      emailCount: emailCountIdx !== -1 ? parseInt(cols[emailCountIdx]?.trim() ?? "0", 10) || 0 : 0,
      lastContacted: lastContactedIdx !== -1 ? cols[lastContactedIdx]?.trim() ?? "" : "",
      createdAt: now,
    });
  }

  return contacts;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
