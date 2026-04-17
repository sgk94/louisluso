/**
 * Pre-flight check before deleting/inactivating a Zoho Books contact.
 * Shows status + invoice/order counts so we can confirm no transactional history
 * will be lost.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/preflight-contact.ts <email>
 */
import "dotenv/config";
import {
  getAllBooksCustomers,
  getBooksContact,
  getInvoicesForContact,
  getSalesOrders,
} from "../lib/zoho/books.ts";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: preflight-contact.ts <email>");
    process.exit(1);
  }

  const all = await getAllBooksCustomers();
  const match = all.find(
    (c) => ((c.email as string) ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!match) {
    console.error(`No contact with email ${email}`);
    process.exit(1);
  }

  const detail = await getBooksContact(match.contact_id);
  const r = detail as Record<string, unknown>;

  const [invoices, orders] = await Promise.all([
    getInvoicesForContact(match.contact_id),
    getSalesOrders(match.contact_id),
  ]);

  console.log(`\n=== ${detail.contact_name} (${match.contact_id}) ===`);
  console.log(`  company:       ${detail.company_name}`);
  console.log(`  email:         ${detail.email}`);
  console.log(`  status:        ${detail.status}`);
  console.log(`  city / state:  ${r.cf_city} / ${r.cf_state}`);
  console.log(`  outstanding:   ${r.outstanding_receivable_amount}`);
  console.log(`  invoices:      ${invoices.length}`);
  console.log(`  sales orders:  ${orders.length}`);
  if (invoices.length > 0) {
    const last = invoices.reduce((max, i) => (i.date > max ? i.date : max), "");
    console.log(`  last invoice:  ${last}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
