/**
 * Manual single-send script.
 * Usage: npx tsx email/cli-send.ts --to someone@example.com --template outreach-intro --subject "Hello" --var name=John --var company=Acme
 */
import { sendEmail, verifyConnection } from "./send.ts";
import type { TemplateVars } from "./templates.ts";

function parseArgs(): { to: string; template: string; subject: string; vars: TemplateVars; dryRun: boolean; bcc: string[] } {
  const args = process.argv.slice(2);
  let to = "";
  let template = "";
  let subject = "";
  const vars: TemplateVars = {};
  let dryRun = false;
  const bcc: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--to":
        to = args[++i];
        break;
      case "--template":
        template = args[++i];
        break;
      case "--subject":
        subject = args[++i];
        break;
      case "--var": {
        const [key, ...rest] = args[++i].split("=");
        vars[key] = rest.join("=");
        break;
      }
      case "--bcc":
        bcc.push(args[++i]);
        break;
      case "--dry-run":
        dryRun = true;
        break;
    }
  }

  if (!to || !template || !subject) {
    console.error("Usage: npx tsx email/cli-send.ts --to EMAIL --template NAME --subject SUBJECT [--var key=value] [--bcc EMAIL] [--dry-run]");
    process.exit(1);
  }

  return { to, template, subject, vars, dryRun, bcc };
}

async function main(): Promise<void> {
  const { to, template, subject, vars, dryRun, bcc } = parseArgs();

  console.log(`Sending "${template}" to ${to}`);
  if (bcc.length > 0) console.log(`BCC: ${bcc.join(", ")}`);
  console.log(`Subject: ${subject}`);
  console.log(`Vars: ${JSON.stringify(vars)}`);

  if (dryRun) {
    console.log("[DRY RUN] Would send email. Verifying connection only...");
    const ok = await verifyConnection();
    console.log(ok ? "SMTP connection OK" : "SMTP connection FAILED");
    return;
  }

  const ok = await verifyConnection();
  if (!ok) {
    console.error("Cannot connect to SMTP server. Check EMAIL_* env vars.");
    process.exit(1);
  }

  const result = await sendEmail({ to, subject, template, vars, bcc: bcc.length > 0 ? bcc : undefined });
  if (result.success) {
    console.log(`Sent! Message ID: ${result.messageId}`);
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
}

main();
