import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "./send.ts";
import { env } from "./env.ts";
import type { Contact } from "./contacts.ts";
import type { TemplateVars } from "./templates.ts";

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const SEND_LOG_PATH = join(__dir, "send-log.json");

interface SendLogEntry {
  campaignId: string;
  email: string;
  sentAt: string;
  messageId?: string;
}

function loadSendLog(): SendLogEntry[] {
  if (!existsSync(SEND_LOG_PATH)) return [];
  return JSON.parse(readFileSync(SEND_LOG_PATH, "utf-8")) as SendLogEntry[];
}

function saveSendLog(log: SendLogEntry[]): void {
  writeFileSync(SEND_LOG_PATH, JSON.stringify(log, null, 2) + "\n");
}

export interface BatchOptions {
  campaignId: string;
  contacts: Contact[];
  template: string;
  subject: string;
  vars?: TemplateVars;
  dryRun?: boolean;
}

export interface BatchResult {
  sent: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function sendBatch(options: BatchOptions): Promise<BatchResult> {
  const { campaignId, contacts, template, subject, vars = {}, dryRun = false } = options;
  const log = loadSendLog();
  const alreadySent = new Set(
    log.filter((e) => e.campaignId === campaignId).map((e) => e.email.toLowerCase())
  );

  const result: BatchResult = { sent: 0, skipped: 0, errors: 0, details: [] };
  const now = new Date();

  console.log(`\nCampaign "${campaignId}" — ${contacts.length} recipients`);
  console.log(`Already sent: ${alreadySent.size}, remaining: ${contacts.length - alreadySent.size}`);

  for (const contact of contacts) {
    const email = contact.email.toLowerCase();

    if (alreadySent.has(email)) {
      result.skipped++;
      continue;
    }

    // Rate limit delay between sends
    if (result.sent > 0) {
      await sleep(env.EMAIL_DELAY_MS);
    }

    const contactVars: TemplateVars = {
      name: contact.name,
      company: contact.company,
      role: contact.role,
      ...vars,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would send to ${email} (${contact.name}, ${contact.company})`);
      result.sent++;
      continue;
    }

    const sendResult = await sendEmail({
      to: email,
      subject,
      template,
      vars: contactVars,
    });

    if (sendResult.success) {
      log.push({
        campaignId,
        email,
        sentAt: now.toISOString(),
        messageId: sendResult.messageId,
      });
      result.sent++;
      result.details.push(`${email}: sent`);
    } else {
      result.errors++;
      result.details.push(`${email}: ERROR — ${sendResult.error}`);
    }

    // Hourly rate limit
    const sentThisHour = log.filter((e) => {
      return now.getTime() - new Date(e.sentAt).getTime() < 60 * 60 * 1000;
    }).length;

    if (sentThisHour >= env.EMAIL_MAX_PER_HOUR) {
      console.log(`  Rate limit reached (${env.EMAIL_MAX_PER_HOUR}/hour). Stopping.`);
      console.log(`  Re-run to continue from where you left off.`);
      break;
    }
  }

  if (!dryRun) {
    saveSendLog(log);
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
