import "dotenv/config";
import { getBooksContact } from "../lib/zoho/books.ts";

const ids = [
  // first-touch GA (all 7; we'll show all so Shawn can decide skips)
  { id: "", email: "chasidy@advancedeye2020.com", company: "Advanced Eyecare Center" },
  { id: "", email: "jeremiahkim@gmail.com", company: "EYEDREAM EYECARE (NO MORE BUSINESS)" },
  { id: "", email: "aiden@joynus.com", company: "Joynus (Eric Lee)" },
  { id: "", email: "jy@lolkousa.com", company: "LOLKO LLC" },
  { id: "", email: "roswellpearle@gmail.com", company: "PEARLE VISION- ROSWELL" },
  { id: "", email: "mgraham@qspex.com", company: "QSPEX" },
  { id: "", email: "ap.eye.elements@eyecare-partners.com", company: "SHARPER VISION/ EYECARE PARTNERS" },
];

async function main() {
  const report = require("/tmp/trip-invoice-status.json");
  const ga = report["GA (Atlanta, 4/16-17)"];
  const all = [...ga.firstTouch, ...ga.established];

  for (const entry of ids) {
    const match = all.find((c: { email: string }) => c.email === entry.email);
    if (!match) {
      console.log(`\n--- ${entry.email} | NOT FOUND ---`);
      continue;
    }
    const detail = await getBooksContact(match.contact_id);
    const cp = (detail as unknown as { contact_persons?: Array<{ first_name?: string; last_name?: string; email?: string; phone?: string; salutation?: string }> }).contact_persons ?? [];
    console.log(`\n--- ${entry.email} ---`);
    console.log(`  company_name:    ${detail.company_name}`);
    console.log(`  contact_name:    ${detail.contact_name}`);
    console.log(`  first/last name: ${(detail as unknown as { first_name?: string }).first_name ?? ""} / ${(detail as unknown as { last_name?: string }).last_name ?? ""}`);
    console.log(`  contact_persons:`);
    for (const p of cp) {
      const full = [p.salutation, p.first_name, p.last_name].filter(Boolean).join(" ");
      console.log(`    • ${full || "(no name)"} | ${p.email ?? ""} | ${p.phone ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
