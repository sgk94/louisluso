/**
 * Import contacts from CSV.
 * Usage: npx tsx email/cli-import.ts --file contacts.csv [--tag vision-source] [--tag distributor]
 */
import { readFileSync } from "fs";
import { parseCSV, addContacts } from "./contacts.ts";

function parseArgs(): { file: string; tags: string[] } {
  const args = process.argv.slice(2);
  let file = "";
  const tags: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
        file = args[++i];
        break;
      case "--tag":
        tags.push(args[++i]);
        break;
    }
  }

  if (!file) {
    console.error("Usage: npx tsx email/cli-import.ts --file FILE.csv [--tag TAG ...]");
    process.exit(1);
  }

  return { file, tags };
}

function main(): void {
  const { file, tags } = parseArgs();

  console.log(`Importing from: ${file}`);
  if (tags.length) console.log(`Tags: ${tags.join(", ")}`);

  const csv = readFileSync(file, "utf-8");
  const parsed = parseCSV(csv, tags.length > 0 ? tags : undefined);
  console.log(`Parsed ${parsed.length} contacts from CSV`);

  const { added, skipped } = addContacts(parsed);
  console.log(`Added: ${added}, Skipped (duplicate): ${skipped}`);
}

main();
