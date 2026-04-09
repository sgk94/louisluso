/**
 * Example marketing blast: new collection announcement.
 * Usage: npx tsx email/campaigns/new-collection-blast.ts [--dry-run] [--tag independent]
 */
import "../env.ts";
import { getContactsByTag, loadContacts } from "../contacts.ts";
import { sendBatch } from "../batch.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tagIdx = args.indexOf("--tag");
const tag = tagIdx !== -1 ? args[tagIdx + 1] : undefined;

async function main(): Promise<void> {
  const contacts = tag ? getContactsByTag(tag) : loadContacts();
  console.log(`Contacts: ${contacts.length}${tag ? ` (tag: ${tag})` : " (all)"}`);

  const result = await sendBatch({
    campaignId: "new-collection-2026-03",
    contacts,
    template: "marketing-newsletter",
    subject: "Introducing Our New Collection — Louis Luso Eyewear",
    vars: {
      collection_name: "Spring 2026",
      product_line: "Signature Plus Series",
    },
    dryRun,
  });

  console.log(`\nResults: sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors}`);
  for (const detail of result.details) {
    console.log(`  ${detail}`);
  }
}

main();
