/**
 * Run a drip sequence, check status, tag replies, or log conversion stages.
 *
 * Usage:
 *   npx tsx email/cli-sequence.ts run --sequence NAME [--dry-run]
 *   npx tsx email/cli-sequence.ts status --sequence NAME
 *   npx tsx email/cli-sequence.ts reply --email EMAIL [--sequence NAME]
 *   npx tsx email/cli-sequence.ts tag --email EMAIL --tag warm [--sentiment positive] [--notes "wants samples"] [--sequence NAME]
 *   npx tsx email/cli-sequence.ts stage --email EMAIL --stage sample-requested [--notes "asked for 3 frames"] [--sequence NAME]
 *   npx tsx email/cli-sequence.ts report [--sequence NAME]
 */
import { runSequence, getSequenceStatus, markReplied } from "./sequences.ts";
import { SEQUENCES } from "./campaigns/sequence-configs.ts";
import {
  logReplyFeedback,
  logStage,
  getPerformanceByStep,
  getPerformanceBySubject,
  getPerformanceBySendTime,
  getPerformanceBySegment,
  getConversionFunnel,
} from "./sent-log.ts";

type Command = "run" | "status" | "reply" | "tag" | "stage" | "report";

interface ParsedArgs {
  command: Command;
  sequence: string;
  email: string;
  dryRun: boolean;
  tag: string;
  sentiment: string;
  notes: string;
  stage: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    command: "status",
    sequence: "",
    email: "",
    dryRun: false,
    tag: "",
    sentiment: "",
    notes: "",
    stage: "",
  };

  if (args[0] && !args[0].startsWith("--")) {
    result.command = args[0] as Command;
  }

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--sequence": result.sequence = args[++i] ?? ""; break;
      case "--email": result.email = args[++i] ?? ""; break;
      case "--tag": result.tag = args[++i] ?? ""; break;
      case "--sentiment": result.sentiment = args[++i] ?? ""; break;
      case "--notes": result.notes = args[++i] ?? ""; break;
      case "--stage": result.stage = args[++i] ?? ""; break;
      case "--dry-run": result.dryRun = true; break;
    }
  }

  return result;
}

function printReport(sequenceName?: string): void {
  console.log("\n=== Performance by Step ===");
  const stepStats = getPerformanceByStep();
  const filtered = sequenceName
    ? stepStats.filter((s) => s.sequence === sequenceName || s.sequence === SEQUENCES[sequenceName]?.name)
    : stepStats;

  if (filtered.length === 0) {
    console.log("  No data yet. Send some emails first.");
    return;
  }

  for (const s of filtered) {
    console.log(`  ${s.sequence} step ${s.step} (${s.template}): ${(s.replyRate * 100).toFixed(1)}% reply rate (${s.replied}/${s.totalSent})`);
    if (s.avgDaysToReply != null) console.log(`    Avg days to reply: ${s.avgDaysToReply.toFixed(1)}`);
    if (Object.keys(s.tags).length > 0) console.log(`    Tags: ${JSON.stringify(s.tags)}`);
    if (Object.keys(s.sentiments).length > 0) console.log(`    Sentiments: ${JSON.stringify(s.sentiments)}`);
  }

  console.log("\n=== Subject Line Performance ===");
  const subjectStats = getPerformanceBySubject();
  for (const s of subjectStats) {
    console.log(`  "${s.subject}" [${s.variant}]: ${(s.replyRate * 100).toFixed(1)}% (${s.replied}/${s.totalSent})`);
  }

  console.log("\n=== Send Time Performance ===");
  const timeStats = getPerformanceBySendTime();
  for (const t of timeStats) {
    if (t.totalSent < 1) continue;
    console.log(`  ${t.dayName} ${t.hour}:00 — ${(t.replyRate * 100).toFixed(1)}% reply rate (${t.replied}/${t.totalSent})`);
  }

  console.log("\n=== Segment Performance ===");
  const segStats = getPerformanceBySegment();
  for (const s of segStats) {
    console.log(`  ${s.segment}: ${(s.replyRate * 100).toFixed(1)}% reply rate (${s.replied}/${s.totalSent})`);
  }

  console.log("\n=== Conversion Funnel ===");
  const funnels = getConversionFunnel();
  if (funnels.length === 0) {
    console.log("  No conversion stages logged yet.");
  }
  for (const f of funnels) {
    console.log(`  ${f.to} (${f.company}) — ${f.currentStage}`);
    for (const s of f.stages) {
      console.log(`    ${s.ts.slice(0, 10)} → ${s.stage}${s.notes ? ` (${s.notes})` : ""}`);
    }
  }
}

async function main(): Promise<void> {
  const { command, sequence: sequenceName, email, dryRun, tag, sentiment, notes, stage } = parseArgs();

  // --- tag command ---
  if (command === "tag") {
    if (!email || !tag) {
      console.error("Usage: cli-sequence.ts tag --email EMAIL --tag TAG [--sentiment positive|neutral|negative] [--notes \"...\"] [--sequence NAME]");
      process.exit(1);
    }
    const validSentiments = ["positive", "neutral", "negative"];
    const sentimentVal = validSentiments.includes(sentiment)
      ? sentiment as "positive" | "neutral" | "negative"
      : undefined;

    logReplyFeedback({
      to: email.toLowerCase(),
      sequence: sequenceName ? SEQUENCES[sequenceName]?.name : undefined,
      tag,
      sentiment: sentimentVal,
      notes: notes || undefined,
    });
    console.log(`  Tagged ${email}: ${tag}${sentimentVal ? ` (${sentimentVal})` : ""}${notes ? ` — "${notes}"` : ""}`);
    return;
  }

  // --- stage command ---
  if (command === "stage") {
    if (!email || !stage) {
      console.error("Usage: cli-sequence.ts stage --email EMAIL --stage STAGE [--notes \"...\"] [--sequence NAME]");
      console.error("  Stages: replied, sample-requested, meeting-booked, order, reorder");
      process.exit(1);
    }
    const validStages = ["replied", "sample-requested", "meeting-booked", "order", "reorder"];
    if (!validStages.includes(stage)) {
      console.error(`Invalid stage: "${stage}". Valid: ${validStages.join(", ")}`);
      process.exit(1);
    }
    logStage({
      to: email.toLowerCase(),
      sequence: sequenceName ? SEQUENCES[sequenceName]?.name : undefined,
      stage: stage as "replied" | "sample-requested" | "meeting-booked" | "order" | "reorder",
      notes: notes || undefined,
    });
    console.log(`  ${email} → ${stage}${notes ? ` — "${notes}"` : ""}`);
    return;
  }

  // --- report command ---
  if (command === "report") {
    printReport(sequenceName || undefined);
    return;
  }

  // --- reply command ---
  if (command === "reply") {
    if (!email) {
      console.error("Usage: cli-sequence.ts reply --email EMAIL [--sequence NAME]");
      process.exit(1);
    }
    markReplied(email, sequenceName || undefined);
    return;
  }

  // --- run / status commands need a sequence ---
  if (!sequenceName) {
    console.log("Available sequences:");
    for (const [key, seq] of Object.entries(SEQUENCES)) {
      console.log(`  ${key}: "${seq.name}" (${seq.steps.length} steps)`);
    }
    console.error("\nUsage: cli-sequence.ts run|status|tag|stage|report --sequence NAME [--dry-run]");
    process.exit(1);
  }

  const config = SEQUENCES[sequenceName];
  if (!config) {
    console.error(`Unknown sequence: "${sequenceName}"`);
    console.error(`Available: ${Object.keys(SEQUENCES).join(", ")}`);
    process.exit(1);
  }

  if (command === "status") {
    const status = getSequenceStatus(config.name);
    console.log(`\nSequence: "${config.name}"`);
    for (const [key, count] of Object.entries(status)) {
      console.log(`  ${key}: ${count}`);
    }
    return;
  }

  if (command === "run") {
    const result = await runSequence(config, { dryRun });
    console.log(`\nResults: sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors}`);
    for (const detail of result.details) {
      console.log(`  ${detail}`);
    }
  }
}

main();
