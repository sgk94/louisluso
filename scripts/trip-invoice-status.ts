/**
 * Classify trip-target contacts as first-touch (no invoices) vs established
 * (has invoices). Emits a JSON report to /tmp.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import {
  getAllBooksCustomers,
  getInvoicesForContact,
  type ZohoInvoice,
} from "../lib/zoho/books.ts";

const THROTTLE_MS = 1000;

interface Contact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  cf_state: string;
  cf_city: string;
  created_time: string;
}

// Metro bucket definitions — case-insensitive city match.
const METROS = {
  "GA (Atlanta, 4/16-17)": {
    states: ["GA"],
    cities: null as string[] | null, // null = all cities in state
  },
  "SF Bay Area (4/21-24)": {
    states: ["CA"],
    cities: [
      "san francisco", "oakland", "berkeley", "san jose", "palo alto",
      "mountain view", "san mateo", "sunnyvale", "san carlos", "redwood city",
      "menlo park", "fremont", "newark", "burlingame", "millbrae",
      "daly city", "south san francisco", "hayward", "santa clara", "cupertino",
      "los altos", "los gatos", "saratoga", "campbell", "milpitas",
      "davis", "fairfax",
    ],
  },
  "Houston metro (4/27-30)": {
    states: ["TX"],
    cities: [
      "houston", "sugar land", "katy", "bellaire", "humble", "spring",
      "friendswood", "league city", "missouri city", "richmond", "galveston",
      "pearland", "the woodlands", "kingwood", "stafford", "pasadena",
    ],
  },
  "Las Vegas (5/5-8)": {
    states: ["NV"],
    cities: ["las vegas", "north las vegas", "henderson", "summerlin"],
  },
  "LA metro (5/5-8)": {
    states: ["CA"],
    cities: [
      "los angeles", "long beach", "pasadena", "santa monica", "beverly hills",
      "glendale", "burbank", "anaheim", "santa ana", "irvine", "huntington beach",
      "torrance", "buena park", "rowland heights", "west covina", "cerritos",
      "garden grove", "la palma", "gardena", "westminster", "encino", "monrovia",
      "santa clarita", "thousand oaks", "westlake village", "diamond bar",
      "montrose", "fullerton", "palm desert", "fontana", "ontario", "rancho cucamonga",
      "riverside", "san bernardino", "orange", "costa mesa", "newport beach",
      "laguna beach", "fullerton", "whittier", "norwalk", "downey",
    ],
  },
};

function read(c: Record<string, unknown>, key: string): string {
  return String(c[key] ?? "").trim();
}

function cityMatches(contactCity: string, allowedCities: string[] | null): boolean {
  if (!allowedCities) return true;
  const lc = contactCity.trim().toLowerCase().replace(/,$/, "").trim();
  return allowedCities.includes(lc);
}

async function main() {
  console.log("Fetching all Books customers...");
  const all = await getAllBooksCustomers();
  const active = all.filter((c) => c.status === "active");
  const contacts: Contact[] = active.map((c) => {
    const r = c as Record<string, unknown>;
    return {
      contact_id: c.contact_id,
      contact_name: c.contact_name ?? "",
      company_name: c.company_name ?? "",
      email: (c.email as string) ?? "",
      cf_state: read(r, "cf_state"),
      cf_city: read(r, "cf_city"),
      created_time: read(r, "created_time"),
    };
  });
  console.log(`  ${all.length} total, ${active.length} active`);

  // Per-contact invoice lookup, memoized so the same contact isn't queried twice
  // if they appear in multiple metros.
  const invoiceCache = new Map<string, ZohoInvoice[]>();

  async function getInvoices(id: string): Promise<ZohoInvoice[]> {
    if (invoiceCache.has(id)) return invoiceCache.get(id)!;
    const invs = await getInvoicesForContact(id);
    invoiceCache.set(id, invs);
    return invs;
  }

  const report: Record<string, {
    firstTouch: Array<Contact & { invoiceCount: number; lastInvoiceDate: string }>;
    established: Array<Contact & { invoiceCount: number; lastInvoiceDate: string; totalBilled: number }>;
  }> = {};

  for (const [label, cfg] of Object.entries(METROS)) {
    const pool = contacts.filter(
      (c) =>
        cfg.states.includes(c.cf_state) &&
        c.email.trim().length > 0 &&
        cityMatches(c.cf_city, cfg.cities),
    );
    console.log(`\n=== ${label}: ${pool.length} contacts ===`);

    const firstTouch: typeof report[string]["firstTouch"] = [];
    const established: typeof report[string]["established"] = [];

    let idx = 0;
    for (const c of pool) {
      idx++;
      if (idx % 10 === 0) console.log(`  ...${idx}/${pool.length}`);
      const cached = invoiceCache.has(c.contact_id);
      const invs = await getInvoices(c.contact_id);
      if (invs.length === 0) {
        firstTouch.push({ ...c, invoiceCount: 0, lastInvoiceDate: "" });
      } else {
        const lastDate = invs.reduce((max, i) => (i.date > max ? i.date : max), "");
        const total = invs.reduce((sum, i) => sum + (i.total ?? 0), 0);
        established.push({
          ...c,
          invoiceCount: invs.length,
          lastInvoiceDate: lastDate,
          totalBilled: total,
        });
      }
      if (!cached) await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }

    report[label] = { firstTouch, established };
    console.log(`  first-touch (no invoices): ${firstTouch.length}`);
    console.log(`  established (has invoices): ${established.length}`);
  }

  const outPath = "/tmp/trip-invoice-status.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);

  console.log("\n=== SUMMARY ===");
  let ftTotal = 0;
  let esTotal = 0;
  for (const [label, buckets] of Object.entries(report)) {
    console.log(`${label.padEnd(28)} first-touch: ${String(buckets.firstTouch.length).padStart(3)} | established: ${String(buckets.established.length).padStart(3)}`);
    ftTotal += buckets.firstTouch.length;
    esTotal += buckets.established.length;
  }
  console.log(`${"TOTAL".padEnd(28)} first-touch: ${String(ftTotal).padStart(3)} | established: ${String(esTotal).padStart(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
