import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusTracker } from "@/app/portal/quotes/[estimateNumber]/StatusTracker";
import { WORKFLOW_PROFILES, computeStages } from "@/lib/portal/workflow";

describe("StatusTracker", () => {
  const profile = WORKFLOW_PROFILES.cash;

  it("renders five stage labels", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "sent" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByText("Quote Submitted")).toBeInTheDocument();
    expect(screen.getByText("Order Received")).toBeInTheDocument();
    expect(screen.getByText("Invoice Sent")).toBeInTheDocument();
    expect(screen.getByText("Payment Received")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
  });

  it("uses role=progressbar with aria-valuenow=current stage index+1", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "accepted" },
      salesOrder: { created_time: "2026-04-19T10:00:00Z" },
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    const tracker = screen.getByRole("progressbar");
    expect(tracker).toHaveAttribute("aria-valuemax", "5");
    expect(tracker).toHaveAttribute("aria-valuenow", "3"); // stages 1-2 done, stage 3 current
  });

  it("renders submitted-stage date subtitle", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "sent" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByText(/2026-04-18/)).toBeInTheDocument();
  });

  it("declined estimate: stage 2 has aria-label including 'Declined'", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "declined" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByLabelText(/Declined/)).toBeInTheDocument();
  });

  it("expired estimate: stage 2 has aria-label including 'Expired'", () => {
    const stages = computeStages(profile, {
      estimate: { date: "2026-04-18", status: "expired" },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });
    render(<StatusTracker stages={stages} />);
    expect(screen.getByLabelText(/Expired/)).toBeInTheDocument();
  });
});
