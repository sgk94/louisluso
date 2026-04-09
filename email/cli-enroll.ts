/**
 * Enroll contacts into a drip sequence.
 * Usage:
 *   npx tsx email/cli-enroll.ts --sequence vision-source-outreach --tag vision-source
 *   npx tsx email/cli-enroll.ts --sequence vision-source-outreach --email john@example.com --name "John Doe" --company "Eye Care LLC"
 */
import { enrollContact } from "./sequences.ts";
import { getContactsByTag } from "./contacts.ts";
import { SEQUENCES } from "./campaigns/sequence-configs.ts";

function parseArgs(): {
  sequence: string;
  tag?: string;
  email?: string;
  name?: string;
  company?: string;
} {
  const args = process.argv.slice(2);
  let sequence = "";
  let tag: string | undefined;
  let email: string | undefined;
  let name: string | undefined;
  let company: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--sequence":
        sequence = args[++i];
        break;
      case "--tag":
        tag = args[++i];
        break;
      case "--email":
        email = args[++i];
        break;
      case "--name":
        name = args[++i];
        break;
      case "--company":
        company = args[++i];
        break;
    }
  }

  if (!sequence) {
    console.error("Usage: cli-enroll.ts --sequence NAME (--tag TAG | --email EMAIL --name NAME --company COMPANY)");
    process.exit(1);
  }

  return { sequence, tag, email, name, company };
}

function main(): void {
  const { sequence: sequenceName, tag, email, name, company } = parseArgs();

  const config = SEQUENCES[sequenceName];
  if (!config) {
    console.error(`Unknown sequence: "${sequenceName}"`);
    console.error(`Available: ${Object.keys(SEQUENCES).join(", ")}`);
    process.exit(1);
  }

  if (tag) {
    const contacts = getContactsByTag(tag);
    console.log(`Enrolling ${contacts.length} contacts tagged "${tag}" into "${config.name}"`);
    for (const contact of contacts) {
      enrollContact(config, contact.email, contact.name, contact.company);
    }
  } else if (email && name && company) {
    enrollContact(config, email, name, company);
  } else {
    console.error("Provide either --tag or (--email + --name + --company)");
    process.exit(1);
  }
}

main();
