import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "./send.ts";
import { env } from "./env.ts";
import { threadHasReply } from "./gmail.ts";
import { logOutcome } from "./sent-log.ts";
import type { TemplateVars } from "./templates.ts";

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dir, "state.json");

export interface SequenceStep {
  template: string;
  subject: string;
  /** Optional A/B variants — if present, one is picked randomly instead of `subject` */
  subjectVariants?: { variant: string; subject: string }[];
  delayDays: number;
  skipIf: "replied" | "bounced" | "none";
}

export interface SequenceConfig {
  name: string;
  steps: SequenceStep[];
}

export interface ContactState {
  email: string;
  name: string;
  company: string;
  vars: TemplateVars;
  sequenceName: string;
  currentStep: number;
  status: "active" | "replied" | "bounced" | "completed" | "paused";
  lastSentAt: string | null;
  sentSteps: SentStep[];
  enrolledAt: string;
  threadId?: string;
  firstMessageId?: string;
}

interface SentStep {
  step: number;
  sentAt: string;
  messageId?: string;
}

export interface SequenceState {
  contacts: ContactState[];
}

export function loadState(): SequenceState {
  if (!existsSync(STATE_PATH)) {
    return { contacts: [] };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf-8")) as SequenceState;
}

export function saveState(state: SequenceState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

export function enrollContact(
  sequence: SequenceConfig,
  email: string,
  name: string,
  company: string,
  vars: TemplateVars = {}
): void {
  const state = loadState();
  const existing = state.contacts.find(
    (c) => c.email.toLowerCase() === email.toLowerCase() && c.sequenceName === sequence.name
  );

  if (existing) {
    console.log(`  Already enrolled: ${email} in "${sequence.name}" (step ${existing.currentStep}, ${existing.status})`);
    return;
  }

  state.contacts.push({
    email: email.toLowerCase(),
    name,
    company,
    vars: { name, company, ...vars },
    sequenceName: sequence.name,
    currentStep: 0,
    status: "active",
    lastSentAt: null,
    sentSteps: [],
    enrolledAt: new Date().toISOString(),
  });

  saveState(state);
  console.log(`  Enrolled: ${email} in "${sequence.name}"`);
}

export function markReplied(email: string, sequenceName?: string): void {
  const state = loadState();
  for (const contact of state.contacts) {
    if (
      contact.email.toLowerCase() === email.toLowerCase() &&
      contact.status === "active" &&
      (!sequenceName || contact.sequenceName === sequenceName)
    ) {
      contact.status = "replied";
      const lastStep = contact.sentSteps[contact.sentSteps.length - 1];
      const daysToReply = lastStep
        ? (Date.now() - new Date(lastStep.sentAt).getTime()) / (1000 * 60 * 60 * 24)
        : undefined;
      logOutcome({
        to: contact.email,
        sequence: contact.sequenceName,
        step: lastStep?.step,
        outcome: "replied",
        daysToReply: daysToReply != null ? Math.round(daysToReply * 10) / 10 : undefined,
      });
      console.log(`  Marked replied: ${email} in "${contact.sequenceName}"`);
    }
  }
  saveState(state);
}

export interface RunResult {
  sent: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function runSequence(
  sequence: SequenceConfig,
  options: { dryRun?: boolean } = {}
): Promise<RunResult> {
  const state = loadState();
  const now = new Date();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0, details: [] };

  const activeContacts = state.contacts.filter(
    (c) => c.sequenceName === sequence.name && c.status === "active"
  );

  console.log(`\nProcessing "${sequence.name}" — ${activeContacts.length} active contacts`);

  // Batch reply detection for Gmail transport
  if (env.EMAIL_TRANSPORT === "gmail") {
    const contactsWithThreads = activeContacts.filter(
      (c) => c.threadId && c.currentStep > 0
    );
    if (contactsWithThreads.length > 0) {
      console.log(`  Checking ${contactsWithThreads.length} threads for replies...`);
      for (const contact of contactsWithThreads) {
        try {
          const hasReply = await threadHasReply(contact.threadId!, env.EMAIL_FROM_ADDRESS);
          if (hasReply) {
            contact.status = "replied";
            result.details.push(`${contact.email}: auto-detected reply via Gmail`);
            const lastStep = contact.sentSteps[contact.sentSteps.length - 1];
            const daysToReply = lastStep
              ? (Date.now() - new Date(lastStep.sentAt).getTime()) / (1000 * 60 * 60 * 24)
              : undefined;
            logOutcome({
              to: contact.email,
              sequence: contact.sequenceName,
              step: lastStep?.step,
              outcome: "replied",
              daysToReply: daysToReply != null ? Math.round(daysToReply * 10) / 10 : undefined,
            });
          }
        } catch {
          // Continue on individual check failures
        }
      }
    }
  }

  for (const contact of activeContacts) {
    // Skip contacts that were just marked as replied by batch check
    if (contact.status !== "active") {
      result.skipped++;
      continue;
    }

    const step = sequence.steps[contact.currentStep];
    if (!step) {
      contact.status = "completed";
      result.details.push(`${contact.email}: completed sequence`);
      continue;
    }

    // Check skip condition
    if (step.skipIf === "replied" && contact.status === "replied") {
      result.skipped++;
      result.details.push(`${contact.email}: skipped step ${contact.currentStep} (replied)`);
      continue;
    }

    // Check delay
    if (contact.lastSentAt) {
      const lastSent = new Date(contact.lastSentAt);
      const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < step.delayDays) {
        result.skipped++;
        result.details.push(
          `${contact.email}: waiting (${daysSince.toFixed(1)}/${step.delayDays} days)`
        );
        continue;
      }
    }

    // Rate limit
    if (result.sent > 0) {
      await sleep(env.EMAIL_DELAY_MS);
    }

    const vars = { ...contact.vars, name: contact.name, company: contact.company };

    if (options.dryRun) {
      console.log(`  [DRY RUN] Would send "${step.template}" to ${contact.email}`);
      result.sent++;
      continue;
    }

    // Pick subject (A/B variant or default)
    let subject = step.subject;
    let subjectVariant: string | undefined;
    if (step.subjectVariants && step.subjectVariants.length > 0) {
      const pick = step.subjectVariants[Math.floor(Math.random() * step.subjectVariants.length)]!;
      subject = pick.subject;
      subjectVariant = pick.variant;
    }

    const sendResult = await sendEmail({
      to: contact.email,
      subject,
      template: step.template,
      vars,
      threadId: contact.threadId,
      inReplyTo: contact.firstMessageId,
      contactName: contact.name,
      contactCompany: contact.company,
      sequenceName: contact.sequenceName,
      sequenceStep: contact.currentStep,
      subjectVariant,
      segment: contact.vars.segment,
    });

    if (sendResult.success) {
      contact.sentSteps.push({
        step: contact.currentStep,
        sentAt: now.toISOString(),
        messageId: sendResult.messageId,
      });
      contact.lastSentAt = now.toISOString();

      // Store thread info from first send
      if (contact.currentStep === 0) {
        contact.threadId = sendResult.threadId;
        contact.firstMessageId = sendResult.messageId;
      }

      contact.currentStep++;
      result.sent++;
      result.details.push(`${contact.email}: sent step ${contact.currentStep - 1} (${step.template})`);

      // Check if sequence is done
      if (contact.currentStep >= sequence.steps.length) {
        contact.status = "completed";
        logOutcome({
          to: contact.email,
          sequence: contact.sequenceName,
          step: contact.currentStep - 1,
          outcome: "completed",
        });
      }
    } else {
      result.errors++;
      result.details.push(`${contact.email}: ERROR — ${sendResult.error}`);
    }

    // Hourly rate limit check
    const sentThisHour = state.contacts
      .flatMap((c) => c.sentSteps)
      .filter((s) => {
        const sentAt = new Date(s.sentAt);
        return now.getTime() - sentAt.getTime() < 60 * 60 * 1000;
      }).length;

    if (sentThisHour >= env.EMAIL_MAX_PER_HOUR) {
      console.log(`  Rate limit reached (${env.EMAIL_MAX_PER_HOUR}/hour). Stopping.`);
      break;
    }
  }

  saveState(state);
  return result;
}

export function getSequenceStatus(sequenceName: string): Record<string, number> {
  const state = loadState();
  const contacts = state.contacts.filter((c) => c.sequenceName === sequenceName);
  const counts: Record<string, number> = {
    total: contacts.length,
    active: 0,
    replied: 0,
    bounced: 0,
    completed: 0,
    paused: 0,
  };

  for (const c of contacts) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  return counts;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
