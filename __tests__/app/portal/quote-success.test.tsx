import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));
const { mockGetEstimateByNumber } = vi.hoisted(() => ({
  mockGetEstimateByNumber: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("@/lib/zoho/books", async () => {
  const actual: Record<string, unknown> = await vi.importActual("@/lib/zoho/books");
  return {
    ...actual,
    getEstimateByNumber: mockGetEstimateByNumber,
  };
});

import QuoteSuccessPage from "@/app/portal/quote/success/[estimateNumber]/page";

const PARTNER = {
  id: "u1",
  publicMetadata: { role: "partner", zohoContactId: "cust-1", company: "Test Co" },
};

const PARTNER_NO_ZOHO = {
  id: "u1",
  publicMetadata: { role: "partner", company: "Test Co" },
};

const ESTIMATE = {
  estimate_id: "est-42",
  estimate_number: "EST-00042",
  customer_id: "cust-1",
  date: "2026-04-12",
  status: "sent" as const,
  total: 1383,
  sub_total: 1383,
  currency_code: "USD",
  line_items: [
    {
      line_item_id: "li-1",
      item_id: "item-1",
      name: "SG-1011",
      sku: "SG-1011-C1",
      quantity: 5,
      rate: 76,
      item_total: 380,
    },
    {
      line_item_id: "li-2",
      item_id: "item-2",
      name: "LC-9018",
      sku: "LC-9018-C1",
      quantity: 3,
      rate: 81,
      item_total: 243,
    },
  ],
};

function params(estimateNumber: string): Promise<{ estimateNumber: string }> {
  return Promise.resolve({ estimateNumber });
}

describe("QuoteSuccessPage", () => {
  beforeEach(() => {
    mockCurrentUser.mockReset();
    mockGetEstimateByNumber.mockReset();
  });

  it("renders line items, total, and action buttons on happy path", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockResolvedValue(ESTIMATE);

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(screen.getByText("Quote Submitted")).toBeInTheDocument();
    expect(screen.getByText(/EST-00042/)).toBeInTheDocument();
    expect(screen.getByText("SG-1011")).toBeInTheDocument();
    expect(screen.getByText("LC-9018")).toBeInTheDocument();
    expect(screen.getByText(/8 items/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,383/)).toBeInTheDocument();

    const browse = screen.getByText("Browse Catalog").closest("a");
    const myQuotes = screen.getByText("My Quotes").closest("a");
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(browse?.getAttribute("href")).toBe("/eyeglasses");
    expect(myQuotes?.getAttribute("href")).toBe("/portal/quotes");
    expect(dashboard?.getAttribute("href")).toBe("/portal");
  });

  it("renders not-found state when estimate is null", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockResolvedValue(null);

    const element = await QuoteSuccessPage({ params: params("EST-99999") });
    render(element);

    expect(screen.getByText(/couldn.t find that quote/i)).toBeInTheDocument();
    expect(
      screen.getByText(/View My Quotes/).closest("a")?.getAttribute("href"),
    ).toBe("/portal/quotes");
  });

  it("renders generic error state when getEstimateByNumber throws", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER);
    mockGetEstimateByNumber.mockRejectedValue(new Error("Zoho 500"));

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(
      screen.getByText(/Unable to load quote right now/i),
    ).toBeInTheDocument();
  });

  it("renders account-setup error when zohoContactId missing", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_NO_ZOHO);

    const element = await QuoteSuccessPage({ params: params("EST-00042") });
    render(element);

    expect(
      screen.getByText(/Account setup incomplete/i),
    ).toBeInTheDocument();
    expect(mockGetEstimateByNumber).not.toHaveBeenCalled();
  });
});
