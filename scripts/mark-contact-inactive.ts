/**
 * Mark a Zoho Books contact inactive. Reversible via Zoho UI.
 * Usage: npx tsx scripts/mark-contact-inactive.ts <email>
 */
import "dotenv/config";
import { getAllBooksCustomers } from "../lib/zoho/books.ts";
import { zohoFetch } from "../lib/zoho/client.ts";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: mark-contact-inactive.ts <email>");
    process.exit(1);
  }
  const all = await getAllBooksCustomers();
  const match = all.find(
    (c) => ((c.email as string) ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!match) {
    console.error(`Not found: ${email}`);
    process.exit(1);
  }
  console.log(
    `Marking ${match.company_name || match.contact_name} (${match.contact_id}) inactive...`,
  );
  if (match.status === "inactive") {
    console.log("Already inactive. No-op.");
    return;
  }
  await zohoFetch(`/books/v3/contacts/${match.contact_id}/inactive`, { method: "POST" });
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
