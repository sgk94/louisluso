import "dotenv/config";
import { readFileSync } from "fs";

// --- Security: verify .env is gitignored ---
function verifyGitignore(): void {
  try {
    const gitignore = readFileSync(".gitignore", "utf-8");
    if (!gitignore.split("\n").some((line) => line.trim() === ".env")) {
      console.error("ABORT: .env is not listed in .gitignore.");
      process.exit(1);
    }
  } catch {
    console.error("ABORT: No .gitignore found.");
    process.exit(1);
  }
}

verifyGitignore();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let email = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--email":
        email = args[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
    }
  }

  const { z } = await import("zod");
  if (!email || !z.string().email().safeParse(email).success) {
    console.error("Usage: pnpm portal:invite -- --email dealer@store.com [--dry-run]");
    process.exit(1);
  }

  console.log(`Looking up ${email} in Zoho CRM...`);

  // Dynamic imports for Zoho env
  const { getContactByEmail } = await import("../lib/zoho/crm.ts");

  const contact = await getContactByEmail(email);
  if (!contact) {
    console.error(`No Zoho CRM Contact found for ${email}`);
    process.exit(1);
  }

  const firstName = contact.First_Name || "Partner";
  const company = contact.Account_Name || "";

  console.log(`Found: ${firstName} ${contact.Last_Name} — ${company}`);

  const { sendPartnerInvite } = await import("../lib/portal/invite.ts");
  const result = await sendPartnerInvite(contact, { dryRun });

  if (result.dryRun) {
    console.log("\n--- DRY RUN ---");
    console.log(`To: ${email}`);
    console.log(`Subject: ${result.subject}`);
    console.log(`\n${result.body}`);
    console.log("--- END DRY RUN ---\n");
    return;
  }

  console.log(`Invite sent to ${email}`);
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
