export type StageId =
  | "submitted"
  | "received"
  | "invoice_sent"
  | "payment_received"
  | "shipped";

export type StageStatus =
  | "done"
  | "current"
  | "pending"
  | "declined"
  | "expired";

export interface WorkflowProfile {
  id: "cash" | "net30";
  label: string;
  stages: StageId[];
}

export const WORKFLOW_PROFILES: Record<WorkflowProfile["id"], WorkflowProfile> = {
  cash: {
    id: "cash",
    label: "Standard",
    stages: ["submitted", "received", "invoice_sent", "payment_received", "shipped"],
  },
  net30: {
    id: "net30",
    label: "NET 30",
    stages: ["submitted", "received", "shipped", "invoice_sent", "payment_received"],
  },
};

export function getProfile(id: WorkflowProfile["id"] | undefined): WorkflowProfile {
  if (id && id in WORKFLOW_PROFILES) return WORKFLOW_PROFILES[id];
  return WORKFLOW_PROFILES.cash;
}

export interface LifecycleData {
  estimate: {
    date: string;
    status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  };
  salesOrder: { created_time: string } | null;
  invoice: {
    date: string;
    status: "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void";
    total: number;
    last_payment_date: string | null;
  } | null;
  shipment: {
    tracking_number: string;
    carrier: string;
    date: string;
  } | null;
}

export interface StageState {
  id: StageId;
  label: string;
  status: StageStatus;
  date?: string;
  meta?: Record<string, string>;
}

const STAGE_LABELS: Record<StageId, string> = {
  submitted: "Quote Submitted",
  received: "Order Received",
  invoice_sent: "Invoice Sent",
  payment_received: "Payment Received",
  shipped: "Shipped",
};

function isStageDone(id: StageId, data: LifecycleData): boolean {
  switch (id) {
    case "submitted":
      return true;
    case "received":
      return data.estimate.status === "accepted" || data.salesOrder !== null;
    case "invoice_sent":
      return data.invoice !== null;
    case "payment_received":
      return data.invoice?.status === "paid";
    case "shipped":
      return Boolean(data.shipment?.tracking_number);
  }
}

function stageDate(id: StageId, data: LifecycleData): string | undefined {
  switch (id) {
    case "submitted":
      return data.estimate.date;
    case "received":
      return data.salesOrder?.created_time;
    case "invoice_sent":
      return data.invoice?.date;
    case "payment_received":
      return data.invoice?.last_payment_date ?? undefined;
    case "shipped":
      return data.shipment?.date;
  }
}

export function computeStages(profile: WorkflowProfile, data: LifecycleData): StageState[] {
  // Terminal-not-success paths short-circuit at stage 2.
  const terminal: StageStatus | null =
    data.estimate.status === "declined"
      ? "declined"
      : data.estimate.status === "expired"
        ? "expired"
        : null;

  return profile.stages.map((id, idx): StageState => {
    if (id === "submitted") {
      return { id, label: STAGE_LABELS[id], status: "done", date: stageDate(id, data) };
    }
    if (idx === 1 && terminal) {
      return { id, label: STAGE_LABELS[id], status: terminal };
    }
    if (terminal) {
      return { id, label: STAGE_LABELS[id], status: "pending" };
    }

    const done = isStageDone(id, data);
    if (done) {
      return { id, label: STAGE_LABELS[id], status: "done", date: stageDate(id, data) };
    }
    // First non-done stage = current. Subsequent = pending.
    const firstPendingIdx = profile.stages.findIndex((sid) => !isStageDone(sid, data));
    return {
      id,
      label: STAGE_LABELS[id],
      status: idx === firstPendingIdx ? "current" : "pending",
    };
  });
}

const TTL_IN_FLIGHT_SEC = 60;
const TTL_TERMINAL_SEC = 900; // 15 min

export function computeCacheTTL(stages: StageState[]): number {
  const allDone = stages.every((s) => s.status === "done");
  const anyTerminal = stages.some((s) => s.status === "declined" || s.status === "expired");
  return allDone || anyTerminal ? TTL_TERMINAL_SEC : TTL_IN_FLIGHT_SEC;
}
