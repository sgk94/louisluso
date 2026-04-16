import "dotenv/config";
import { getBooksContact } from "../../lib/zoho/books.ts";

const expected: Array<[string, string, string]> = [
  ["3278693000000232155", "ND", "FARGO"],
  ["3278693000000232168", "KY", "CRESTWOOD"],
  ["3278693000000232220", "OK", "ADA"],
  ["3278693000000232233", "TX", "FORT WORTH"],
  ["3278693000000239433", "NY", "BROOKLYN"],
];

async function main() {
  let fail = 0;
  for (const [id, expState, expCity] of expected) {
    const c = await getBooksContact(id);
    const gotState = String((c as Record<string, unknown>).cf_state ?? "");
    const gotCity = String((c as Record<string, unknown>).cf_city ?? "");
    const ok = gotState === expState && gotCity === expCity;
    if (!ok) fail++;
    console.log(
      `  [${ok ? "OK  " : "FAIL"}] ${id} | cf_state=${gotState} (want ${expState}) | cf_city=${gotCity} (want ${expCity})`,
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\n${fail === 0 ? "ALL GOOD" : `FAILURES: ${fail}/${expected.length}`}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
