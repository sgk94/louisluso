import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuotesTable } from "@/app/portal/quotes/QuotesTable";
import type { ZohoEstimateListItem } from "@/lib/zoho/books";

const SAMPLES: ZohoEstimateListItem[] = [
  {
    estimate_id: "e1",
    estimate_number: "EST-00003",
    date: "2026-04-12",
    status: "sent",
    total: 1140,
    currency_code: "USD",
  },
  {
    estimate_id: "e2",
    estimate_number: "EST-00002",
    date: "2026-04-08",
    status: "accepted",
    total: 760,
    currency_code: "USD",
  },
  {
    estimate_id: "e3",
    estimate_number: "EST-00001",
    date: "2026-03-28",
    status: "invoiced",
    total: 2420,
    currency_code: "USD",
  },
];

describe("QuotesTable", () => {
  it("renders each estimate's number, formatted date, status label, and total", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={false} />);

    expect(screen.getByText("EST-00003")).toBeInTheDocument();
    expect(screen.getByText("EST-00002")).toBeInTheDocument();
    expect(screen.getByText("EST-00001")).toBeInTheDocument();

    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Order Placed")).toBeInTheDocument();

    expect(screen.getByText("Apr 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("$1,140")).toBeInTheDocument();
    expect(screen.getByText("$760")).toBeInTheDocument();
    expect(screen.getByText("$2,420")).toBeInTheDocument();
  });

  it("applies bronze class to Confirmed pill", () => {
    const { container } = render(
      <QuotesTable estimates={SAMPLES} page={1} hasMore={false} />,
    );
    const confirmedPill = container.querySelector("span.text-bronze");
    expect(confirmedPill).not.toBeNull();
    expect(confirmedPill?.textContent).toBe("Confirmed");
  });

  it("hides pagination controls on single-page result", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={false} />);
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("renders Next only on page 1 with more pages", () => {
    render(<QuotesTable estimates={SAMPLES} page={1} hasMore={true} />);
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.getByText(/Next/)).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("renders both Previous and Next on middle page", () => {
    render(<QuotesTable estimates={SAMPLES} page={3} hasMore={true} />);
    const prev = screen.getByText(/Previous/);
    const next = screen.getByText(/Next/);
    expect(prev).toBeInTheDocument();
    expect(next).toBeInTheDocument();
    expect(prev.closest("a")?.getAttribute("href")).toBe("/portal/quotes?page=2");
    expect(next.closest("a")?.getAttribute("href")).toBe("/portal/quotes?page=4");
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("renders only Previous on last page", () => {
    render(<QuotesTable estimates={SAMPLES} page={4} hasMore={false} />);
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
  });
});
