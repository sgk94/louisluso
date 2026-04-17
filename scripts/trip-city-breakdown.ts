import "dotenv/config";
import { getAllBooksCustomers } from "../lib/zoho/books.ts";

interface Contact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  cf_state: string;
  cf_city: string;
}

function read(c: Record<string, unknown>, key: string): string {
  return String(c[key] ?? "").trim();
}

async function main() {
  const all = await getAllBooksCustomers();
  const contacts: Contact[] = all.map((c) => ({
    contact_id: c.contact_id,
    contact_name: c.contact_name ?? "",
    company_name: c.company_name ?? "",
    email: (c.email as string) ?? "",
    cf_state: read(c as Record<string, unknown>, "cf_state"),
    cf_city: read(c as Record<string, unknown>, "cf_city"),
  }));

  const trips = [
    { name: "GA (4/15-17)", states: ["GA"] },
    { name: "SF Bay Area (4/21-24)", states: ["CA"] },
    { name: "Houston TX (4/27-30)", states: ["TX"] },
    { name: "LV + LA (5/5-8)", states: ["CA", "NV"] },
  ];

  for (const trip of trips) {
    const pool = contacts.filter((c) => trip.states.includes(c.cf_state));
    const withEmail = pool.filter((c) => c.email.trim().length > 0);
    console.log(`\n=== ${trip.name} ===`);
    console.log(`Total: ${pool.length} | With email: ${withEmail.length}`);

    const cityHist = new Map<string, number>();
    for (const c of withEmail) {
      const city = c.cf_city || "(no city)";
      cityHist.set(city, (cityHist.get(city) ?? 0) + 1);
    }
    console.log("Cities:");
    [...cityHist.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)} | ${k}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
