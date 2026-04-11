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

  const signupUrl = process.env.PORTAL_SIGNUP_URL ?? "https://louisluso.com/sign-up";

  const subject = "Welcome to the LOUISLUSO Partner Portal";
  const body = [
    `Hi ${firstName},`,
    "",
    "Great news — your LOUISLUSO partner application has been approved!",
    "",
    "You can now access wholesale pricing and place orders through our Partner Portal.",
    "",
    `To get started, create your account using this email address (${email}):`,
    "",
    signupUrl,
    "",
    "Once you've created your account, you'll have access to:",
    "  - Wholesale pricing on all collections",
    "  - Online ordering (coming soon)",
    "  - Order history and tracking (coming soon)",
    "",
    "If you have any questions, reply to this email or contact us at cs@louisluso.com.",
    "",
    "Welcome aboard!",
    "",
    "— The LOUISLUSO Team",
    "https://louisluso.com",
  ].join("\n");

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`\n${body}`);
    console.log("--- END DRY RUN ---\n");
    return;
  }

  const { sendEmail } = await import("../lib/gmail.ts");
  await sendEmail({ to: email, subject, body });

  console.log(`Invite sent to ${email}`);
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
