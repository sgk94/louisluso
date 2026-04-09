import { appendFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dir, "sent-log.jsonl");

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

interface SentEntry {
  type: "sent";
  ts: string;
  to: string;
  name: string;
  company: string;
  sequence?: string;
  step?: number;
  template: string;
  subject: string;
  subjectVariant?: string;
  bodyText: string;
  messageId?: string;
  threadId?: string;
  transport: string;
  segment?: string;
}

interface OutcomeEntry {
  type: "outcome";
  ts: string;
  to: string;
  sequence?: string;
  step?: number;
  outcome: "replied" | "bounced" | "completed" | "ignored";
  daysToReply?: number;
  tag?: string;
  sentiment?: "positive" | "neutral" | "negative";
  notes?: string;
}

interface StageEntry {
  type: "stage";
  ts: string;
  to: string;
  sequence?: string;
  stage: "replied" | "sample-requested" | "meeting-booked" | "order" | "reorder";
  notes?: string;
}

type LogEntry = SentEntry | OutcomeEntry | StageEntry;

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

function append(entry: LogEntry): void {
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
}

export function logSentEmail(entry: Omit<SentEntry, "type" | "ts">): void {
  append({ type: "sent", ts: new Date().toISOString(), ...entry });
}

export function logOutcome(entry: Omit<OutcomeEntry, "type" | "ts">): void {
  append({ type: "outcome", ts: new Date().toISOString(), ...entry });
}

export function logReplyFeedback(opts: {
  to: string;
  sequence?: string;
  step?: number;
  tag?: string;
  sentiment?: "positive" | "neutral" | "negative";
  notes?: string;
}): void {
  append({
    type: "outcome",
    ts: new Date().toISOString(),
    to: opts.to,
    sequence: opts.sequence,
    step: opts.step,
    outcome: "replied",
    tag: opts.tag,
    sentiment: opts.sentiment,
    notes: opts.notes,
  });
}

export function logStage(entry: Omit<StageEntry, "type" | "ts">): void {
  append({ type: "stage", ts: new Date().toISOString(), ...entry });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function loadSentLog(): LogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEntry);
}

// ---------------------------------------------------------------------------
// Analysis: by step (original)
// ---------------------------------------------------------------------------

export interface EmailPerformance {
  template: string;
  step: number;
  sequence: string;
  totalSent: number;
  replied: number;
  bounced: number;
  ignored: number;
  replyRate: number;
  avgDaysToReply: number | null;
  repliedBodies: string[];
  ignoredBodies: string[];
  tags: Record<string, number>;
  sentiments: Record<string, number>;
}

export function getPerformanceByStep(): EmailPerformance[] {
  const entries = loadSentLog();
  const sentEntries = entries.filter((e): e is SentEntry => e.type === "sent");
  const outcomeEntries = entries.filter((e): e is OutcomeEntry => e.type === "outcome");

  const groups = new Map<string, SentEntry[]>();
  for (const entry of sentEntries) {
    const key = `${entry.sequence ?? "one-off"}|${entry.step ?? 0}`;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  // Latest outcome per contact+sequence+step (last one wins)
  const outcomeLookup = new Map<string, OutcomeEntry>();
  for (const entry of outcomeEntries) {
    const key = `${entry.to}|${entry.sequence ?? "one-off"}|${entry.step ?? 0}`;
    outcomeLookup.set(key, entry);
  }

  const results: EmailPerformance[] = [];

  for (const [groupKey, sends] of groups) {
    const [sequence, stepStr] = groupKey.split("|");
    const step = Number(stepStr);
    let replied = 0;
    let bounced = 0;
    let ignored = 0;
    const replyDays: number[] = [];
    const repliedBodies: string[] = [];
    const ignoredBodies: string[] = [];
    const tags: Record<string, number> = {};
    const sentiments: Record<string, number> = {};

    for (const send of sends) {
      const outcomeKey = `${send.to}|${send.sequence ?? "one-off"}|${send.step ?? 0}`;
      const outcome = outcomeLookup.get(outcomeKey);
      if (!outcome) continue;

      switch (outcome.outcome) {
        case "replied":
          replied++;
          if (outcome.daysToReply != null) replyDays.push(outcome.daysToReply);
          repliedBodies.push(send.bodyText);
          if (outcome.tag) tags[outcome.tag] = (tags[outcome.tag] ?? 0) + 1;
          if (outcome.sentiment) sentiments[outcome.sentiment] = (sentiments[outcome.sentiment] ?? 0) + 1;
          break;
        case "bounced":
          bounced++;
          break;
        case "ignored":
        case "completed":
          ignored++;
          ignoredBodies.push(send.bodyText);
          break;
      }
    }

    const totalWithOutcome = replied + bounced + ignored;

    results.push({
      template: sends[0]?.template ?? "unknown",
      step,
      sequence: sequence ?? "one-off",
      totalSent: sends.length,
      replied,
      bounced,
      ignored,
      replyRate: totalWithOutcome > 0 ? replied / totalWithOutcome : 0,
      avgDaysToReply: replyDays.length > 0
        ? replyDays.reduce((a, b) => a + b, 0) / replyDays.length
        : null,
      repliedBodies,
      ignoredBodies,
      tags,
      sentiments,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Analysis: subject line A/B
// ---------------------------------------------------------------------------

export interface SubjectPerformance {
  subject: string;
  variant: string;
  sequence: string;
  step: number;
  totalSent: number;
  replied: number;
  replyRate: number;
}

export function getPerformanceBySubject(): SubjectPerformance[] {
  const entries = loadSentLog();
  const sentEntries = entries.filter((e): e is SentEntry => e.type === "sent");
  const outcomeEntries = entries.filter((e): e is OutcomeEntry => e.type === "outcome");

  const outcomeLookup = new Map<string, OutcomeEntry>();
  for (const entry of outcomeEntries) {
    const key = `${entry.to}|${entry.sequence ?? "one-off"}|${entry.step ?? 0}`;
    outcomeLookup.set(key, entry);
  }

  // Group by subject text
  const groups = new Map<string, { sends: SentEntry[]; replied: number }>();
  for (const send of sentEntries) {
    const key = send.subject;
    const group = groups.get(key) ?? { sends: [], replied: 0 };
    group.sends.push(send);

    const outcomeKey = `${send.to}|${send.sequence ?? "one-off"}|${send.step ?? 0}`;
    const outcome = outcomeLookup.get(outcomeKey);
    if (outcome?.outcome === "replied") group.replied++;

    groups.set(key, group);
  }

  return [...groups.entries()].map(([subject, { sends, replied }]) => ({
    subject,
    variant: sends[0]?.subjectVariant ?? "default",
    sequence: sends[0]?.sequence ?? "one-off",
    step: sends[0]?.step ?? 0,
    totalSent: sends.length,
    replied,
    replyRate: sends.length > 0 ? replied / sends.length : 0,
  }));
}

// ---------------------------------------------------------------------------
// Analysis: send time
// ---------------------------------------------------------------------------

export interface TimePerformance {
  hour: number;
  dayOfWeek: number;
  dayName: string;
  totalSent: number;
  replied: number;
  replyRate: number;
}

export function getPerformanceBySendTime(): TimePerformance[] {
  const entries = loadSentLog();
  const sentEntries = entries.filter((e): e is SentEntry => e.type === "sent");
  const outcomeEntries = entries.filter((e): e is OutcomeEntry => e.type === "outcome");

  const outcomeLookup = new Map<string, OutcomeEntry>();
  for (const entry of outcomeEntries) {
    const key = `${entry.to}|${entry.sequence ?? "one-off"}|${entry.step ?? 0}`;
    outcomeLookup.set(key, entry);
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Group by hour+dayOfWeek
  const groups = new Map<string, { total: number; replied: number; hour: number; dow: number }>();
  for (const send of sentEntries) {
    const d = new Date(send.ts);
    const hour = d.getHours();
    const dow = d.getDay();
    const key = `${dow}|${hour}`;
    const group = groups.get(key) ?? { total: 0, replied: 0, hour, dow };
    group.total++;

    const outcomeKey = `${send.to}|${send.sequence ?? "one-off"}|${send.step ?? 0}`;
    if (outcomeLookup.get(outcomeKey)?.outcome === "replied") group.replied++;

    groups.set(key, group);
  }

  return [...groups.values()]
    .map((g) => ({
      hour: g.hour,
      dayOfWeek: g.dow,
      dayName: dayNames[g.dow] ?? "?",
      totalSent: g.total,
      replied: g.replied,
      replyRate: g.total > 0 ? g.replied / g.total : 0,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);
}

// ---------------------------------------------------------------------------
// Analysis: segment
// ---------------------------------------------------------------------------

export interface SegmentPerformance {
  segment: string;
  totalSent: number;
  replied: number;
  replyRate: number;
  topTags: Record<string, number>;
}

export function getPerformanceBySegment(): SegmentPerformance[] {
  const entries = loadSentLog();
  const sentEntries = entries.filter((e): e is SentEntry => e.type === "sent");
  const outcomeEntries = entries.filter((e): e is OutcomeEntry => e.type === "outcome");

  const outcomeLookup = new Map<string, OutcomeEntry>();
  for (const entry of outcomeEntries) {
    const key = `${entry.to}|${entry.sequence ?? "one-off"}|${entry.step ?? 0}`;
    outcomeLookup.set(key, entry);
  }

  const groups = new Map<string, { total: number; replied: number; tags: Record<string, number> }>();
  for (const send of sentEntries) {
    const seg = send.segment ?? "untagged";
    const group = groups.get(seg) ?? { total: 0, replied: 0, tags: {} };
    group.total++;

    const outcomeKey = `${send.to}|${send.sequence ?? "one-off"}|${send.step ?? 0}`;
    const outcome = outcomeLookup.get(outcomeKey);
    if (outcome?.outcome === "replied") {
      group.replied++;
      if (outcome.tag) group.tags[outcome.tag] = (group.tags[outcome.tag] ?? 0) + 1;
    }

    groups.set(seg, group);
  }

  return [...groups.entries()].map(([segment, g]) => ({
    segment,
    totalSent: g.total,
    replied: g.replied,
    replyRate: g.total > 0 ? g.replied / g.total : 0,
    topTags: g.tags,
  }));
}

// ---------------------------------------------------------------------------
// Analysis: conversion funnel
// ---------------------------------------------------------------------------

export interface ConversionFunnel {
  to: string;
  company: string;
  sequence: string;
  stages: { stage: string; ts: string; notes?: string }[];
  currentStage: string;
}

export function getConversionFunnel(): ConversionFunnel[] {
  const entries = loadSentLog();
  const stageEntries = entries.filter((e): e is StageEntry => e.type === "stage");
  const sentEntries = entries.filter((e): e is SentEntry => e.type === "sent");

  // Get company from sent entries
  const companyLookup = new Map<string, string>();
  for (const s of sentEntries) {
    if (s.company) companyLookup.set(s.to, s.company);
  }

  // Group stages by contact+sequence
  const funnels = new Map<string, StageEntry[]>();
  for (const entry of stageEntries) {
    const key = `${entry.to}|${entry.sequence ?? "one-off"}`;
    const list = funnels.get(key) ?? [];
    list.push(entry);
    funnels.set(key, list);
  }

  return [...funnels.entries()].map(([key, stages]) => {
    const [to, sequence] = key.split("|");
    const sorted = stages.sort((a, b) => a.ts.localeCompare(b.ts));
    return {
      to: to ?? "",
      company: companyLookup.get(to ?? "") ?? "",
      sequence: sequence ?? "one-off",
      stages: sorted.map((s) => ({ stage: s.stage, ts: s.ts, notes: s.notes })),
      currentStage: sorted[sorted.length - 1]?.stage ?? "unknown",
    };
  });
}
