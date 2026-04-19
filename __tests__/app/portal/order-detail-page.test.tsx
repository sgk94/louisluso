import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitOrderDetail: vi.fn().mockResolvedValue({ success: true, remaining: 59 }),
}));
vi.mock("@/lib/zoho/books", async () => {
  const actual = await vi.importActual<typeof import("@/lib/zoho/books")>("@/lib/zoho/books");
  return {
    ...actual,
    getCachedOrderLifecycle: vi.fn(),
  };
});

import { currentUser } from "@clerk/nextjs/server";
import { rateLimitOrderDetail } from "@/lib/rate-limit";
import { getCachedOrderLifecycle } from "@/lib/zoho/books";
import OrderDetailPage from "@/app/portal/quotes/[estimateNumber]/page";

const partnerUser = {
  id: "user_1",
  publicMetadata: {
    role: "partner",
    zohoContactId: "cust_1",
    company: "Acme Optics",
    workflowProfile: "cash",
  },
  emailAddresses: [{ emailAddress: "p@acme.com" }],
};

describe("OrderDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("renders OrderDetail when partner + estimate exist", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue({
      estimate: {
        estimate_id: "est_1",
        estimate_number: "EST-001",
        customer_id: "cust_1",
        date: "2026-04-18",
        status: "sent",
        total: 100,
        sub_total: 100,
        currency_code: "USD",
        line_items: [],
      },
      salesOrder: null,
      invoice: null,
      shipment: null,
    });

    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByRole("heading", { name: /EST-001/ })).toBeInTheDocument();
  });

  it("shows account-setup error when partner metadata is missing zohoContactId", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user_x",
      publicMetadata: {},
      emailAddresses: [],
    });
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Account setup incomplete/)).toBeInTheDocument();
  });

  it("shows rate-limit error when limiter returns success=false", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (rateLimitOrderDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, remaining: 0 });
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
  });

  it("renders 404 panel when estimate is null", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-NONE" }) });
    render(ui);
    expect(screen.getByText(/couldn't find that quote/i)).toBeInTheDocument();
  });

  it("renders soft-notice when getCachedOrderLifecycle throws", async () => {
    (currentUser as ReturnType<typeof vi.fn>).mockResolvedValue(partnerUser);
    (getCachedOrderLifecycle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("zoho 429"));
    const ui = await OrderDetailPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    render(ui);
    expect(screen.getByText(/Unable to load quote right now/)).toBeInTheDocument();
  });
});
