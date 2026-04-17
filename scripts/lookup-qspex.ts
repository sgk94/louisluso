import "dotenv/config";
import { getAllBooksCustomers } from "../lib/zoho/books.ts";

async function main() {
  const all = await getAllBooksCustomers();
  const q = all.find(
    (c) => ((c.email as string) ?? "").toLowerCase() === "mgraham@qspex.com",
  );
  if (!q) {
    console.log("Not found");
    return;
  }
  const r = q as Record<string, unknown>;
  console.log({
    id: q.contact_id,
    company: q.company_name,
    contact_name: q.contact_name,
    status: q.status,
    cf_state: r.cf_state,
    cf_city: r.cf_city,
    email: q.email,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
