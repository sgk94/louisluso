import "dotenv/config";
import { getAllBooksCustomers } from "../lib/zoho/books.ts";

const TARGETS = ["GA", "CA", "TX"] as const;

function normState(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

async function main() {
  const customers = await getAllBooksCustomers();

  const stateCounts = new Map<string, number>();
  const buckets: Record<string, typeof customers> = { GA: [], CA: [], TX: [] };
  let withState = 0;

  for (const c of customers) {
    const s = normState(c.cf_state);
    if (s) {
      withState++;
      stateCounts.set(s, (stateCounts.get(s) ?? 0) + 1);
    }
    if ((TARGETS as readonly string[]).includes(s)) buckets[s].push(c);
  }

  console.log(`Total Books customers: ${customers.length}`);
  console.log(`With cf_state: ${withState}`);

  console.log(`\nTop 25 distinct cf_state values:`);
  [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)} | "${k}"`));

  for (const code of TARGETS) {
    const list = buckets[code];
    const withEmail = list.filter((c) => (c.email as string)?.trim()).length;
    console.log(`\n${code}: ${list.length} (${withEmail} with email)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
