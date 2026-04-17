import "dotenv/config";
import { getBooksContact } from "../lib/zoho/books.ts";

const emails = [
  "samu28@yahoo.com",
  "betheleyecare2020@gmail.com",
  "pc@betheleyegroup.com",
  "optical@daltonoptometry.com",
  "SAYUMOD@gmail.com",
  "eyegalleria.inc@gmail.com",
  "steve@infocuseyes.com",
  "italyoptical@gmail.com",
  "hchunod@gmail.com",
  "jbrandyp3@gmail.com",
  "kimoptical@gmail.com",
  "chunghyesung@gmail.com",
  "Junmohong1@gmail.com",
  "duluthorbiceyecare@gmail.com",
  "sandydr89@gmail.com",
  "dwinner@eyelink.net",
];

async function main() {
  const report = require("/tmp/trip-invoice-status.json");
  const ga = report["GA (Atlanta, 4/16-17)"];
  const all = [...ga.firstTouch, ...ga.established];

  for (const email of emails) {
    const match = all.find(
      (c: { email: string }) => c.email.toLowerCase() === email.toLowerCase(),
    );
    if (!match) {
      console.log(`\n--- ${email} | NOT FOUND ---`);
      continue;
    }
    const detail = await getBooksContact(match.contact_id);
    const r = detail as unknown as {
      first_name?: string;
      last_name?: string;
      contact_persons?: Array<{
        first_name?: string;
        last_name?: string;
        email?: string;
        salutation?: string;
      }>;
    };
    const cp = r.contact_persons ?? [];
    console.log(`\n--- ${email} ---`);
    console.log(`  company:     ${detail.company_name}`);
    console.log(`  contact_name:${detail.contact_name}`);
    console.log(`  first/last:  ${r.first_name ?? ""} / ${r.last_name ?? ""}`);
    console.log(`  city:        ${(detail as Record<string, unknown>).cf_city ?? ""}`);
    console.log(`  persons:`);
    for (const p of cp) {
      const full = [p.salutation, p.first_name, p.last_name].filter(Boolean).join(" ");
      console.log(`    • ${full || "(no name)"} | ${p.email ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
