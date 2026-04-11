import "dotenv/config";
import { searchLeads } from "../lib/zoho/crm.js";
import { saveContacts } from "../email/contacts.js";
import { buildCriteria, leadsToContacts, type PullFilter } from "./crm-pull-lib.js";
import { getRegionName } from "../lib/crm/regions.js";

function parseArgs(): PullFilter {
  const args = process.argv.slice(2);
  const filter: PullFilter = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--region":
        filter.region = args[++i];
        break;
      case "--state":
        filter.state = args[++i];
        break;
      case "--city":
        filter.city = args[++i];
        break;
      default:
        console.error(`Unknown flag: ${args[i]}`);
        process.exit(1);
    }
  }

  return filter;
}

async function main(): Promise<void> {
  const filter = parseArgs();
  const criteria = buildCriteria(filter);

  const label = filter.region
    ? getRegionName(filter.region) ?? filter.region
    : filter.state ?? filter.city ?? "unknown";

  console.log(`Pulling leads: ${criteria}`);

  const leads = await searchLeads(criteria);
  console.log(`Found ${leads.length} leads for "${label}"`);

  if (leads.length === 0) {
    console.log("No contacts to write.");
    return;
  }

  const contacts = leadsToContacts(leads);
  saveContacts(contacts);
  console.log(`Wrote ${contacts.length} contacts to contacts.json`);
  console.log("Ready for email enrollment.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
