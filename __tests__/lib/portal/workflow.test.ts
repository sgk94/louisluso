import { describe, it, expect } from "vitest";
import {
  WORKFLOW_PROFILES,
  getProfile,
  computeStages,
  computeCacheTTL,
  type StageId,
  type LifecycleData,
} from "@/lib/portal/workflow";

const baseLifecycle: LifecycleData = {
  estimate: { date: "2026-04-18", status: "sent" },
  salesOrder: null,
  invoice: null,
  shipment: null,
};

describe("WORKFLOW_PROFILES", () => {
  it("contains cash and net30 with five stages each", () => {
    expect(WORKFLOW_PROFILES.cash.stages).toHaveLength(5);
    expect(WORKFLOW_PROFILES.net30.stages).toHaveLength(5);
  });

  it("cash order is submitted → received → invoice_sent → payment_received → shipped", () => {
    expect(WORKFLOW_PROFILES.cash.stages).toEqual([
      "submitted",
      "received",
      "invoice_sent",
      "payment_received",
      "shipped",
    ]);
  });

  it("net30 order ships before invoice", () => {
    expect(WORKFLOW_PROFILES.net30.stages).toEqual([
      "submitted",
      "received",
      "shipped",
      "invoice_sent",
      "payment_received",
    ]);
  });
});

describe("getProfile", () => {
  it("returns cash when workflowProfile is undefined", () => {
    expect(getProfile(undefined).id).toBe("cash");
  });
  it("returns the named profile when valid", () => {
    expect(getProfile("net30").id).toBe("net30");
  });
  it("falls back to cash for unknown profile id", () => {
    expect(getProfile("bogus" as unknown as "cash").id).toBe("cash");
  });
});

describe("computeStages — cash profile", () => {
  const profile = WORKFLOW_PROFILES.cash;

  it("just-submitted: stage 1 done, stage 2 current, rest pending", () => {
    const stages = computeStages(profile, baseLifecycle);
    expect(stages.map((s) => s.status)).toEqual([
      "done",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
    expect(stages[0].date).toBe("2026-04-18");
  });

  it("accepted estimate: stage 2 done, stage 3 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
    });
    expect(stages[1].status).toBe("done");
    expect(stages[2].status).toBe("current");
  });

  it("invoice exists: stage 3 done, stage 4 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "sent", total: 100, last_payment_date: null },
    });
    expect(stages[2].status).toBe("done");
    expect(stages[3].status).toBe("current");
  });

  it("invoice paid: stage 4 done, stage 5 current", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
    });
    expect(stages[3].status).toBe("done");
    expect(stages[4].status).toBe("current");
  });

  it("shipped + paid: all done", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-24" },
    });
    expect(stages.every((s) => s.status === "done")).toBe(true);
  });

  it("declined estimate: stage 2 declined, stages 3-5 pending (terminal)", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "declined" },
    });
    expect(stages[1].status).toBe("declined");
    expect(stages.slice(2).every((s) => s.status === "pending")).toBe(true);
  });

  it("expired estimate: stage 2 expired", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "expired" },
    });
    expect(stages[1].status).toBe("expired");
  });
});

describe("computeStages — net30 profile", () => {
  const profile = WORKFLOW_PROFILES.net30;

  it("ships before invoice in stage order", () => {
    const ids = computeStages(profile, baseLifecycle).map((s) => s.id);
    expect(ids).toEqual([
      "submitted",
      "received",
      "shipped",
      "invoice_sent",
      "payment_received",
    ]);
  });

  it("shipment-then-invoice: stage 3 (shipped) done before stage 4 (invoice_sent)", () => {
    const stages = computeStages(profile, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-22" },
    });
    expect(stages[2].id).toBe("shipped");
    expect(stages[2].status).toBe("done");
    expect(stages[3].id).toBe("invoice_sent");
    expect(stages[3].status).toBe("current");
  });
});

describe("computeCacheTTL", () => {
  it("returns 60 when any stage is in-flight", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, baseLifecycle);
    expect(computeCacheTTL(stages)).toBe(60);
  });

  it("returns 900 when all stages are done", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, {
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: { date: "2026-04-20", status: "paid", total: 100, last_payment_date: "2026-04-22" },
      shipment: { tracking_number: "1Z999AA1", carrier: "UPS", date: "2026-04-24" },
    });
    expect(computeCacheTTL(stages)).toBe(900);
  });

  it("returns 900 when terminal-declined", () => {
    const stages = computeStages(WORKFLOW_PROFILES.cash, {
      ...baseLifecycle,
      estimate: { date: "2026-04-18", status: "declined" },
    });
    expect(computeCacheTTL(stages)).toBe(900);
  });
});
