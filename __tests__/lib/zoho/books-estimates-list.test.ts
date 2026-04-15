import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import {
  getEstimatesForContact,
  partnerLabelForEstimateStatus,
} from "@/lib/zoho/books";

describe("partnerLabelForEstimateStatus", () => {
  it("maps draft to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("draft")).toBe("Pending Review");
  });
  it("maps sent to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("sent")).toBe("Pending Review");
  });
  it("maps accepted to Confirmed", () => {
    expect(partnerLabelForEstimateStatus("accepted")).toBe("Confirmed");
  });
  it("maps declined to Declined", () => {
    expect(partnerLabelForEstimateStatus("declined")).toBe("Declined");
  });
  it("maps expired to Expired", () => {
    expect(partnerLabelForEstimateStatus("expired")).toBe("Expired");
  });
  it("maps invoiced to Order Placed", () => {
    expect(partnerLabelForEstimateStatus("invoiced")).toBe("Order Placed");
  });
  it("title-cases unknown statuses as fallback", () => {
    expect(partnerLabelForEstimateStatus("on_hold")).toBe("On_hold");
    expect(partnerLabelForEstimateStatus("")).toBe("");
  });
});

describe("getEstimatesForContact", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  const sampleEstimate = {
    estimate_id: "est-1",
    estimate_number: "EST-00001",
    date: "2026-04-12",
    status: "sent",
    total: 1140,
    currency_code: "USD",
  };

  it("passes correct params with defaults (page=1, per_page=20)", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
      page_context: { has_more_page: false },
    });

    await getEstimatesForContact("cust-1");

    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      params: {
        customer_id: "cust-1",
        sort_column: "date",
        sort_order: "D",
        page: "1",
        per_page: "20",
      },
    });
  });

  it("passes custom page + perPage", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [],
      page_context: { has_more_page: false },
    });

    await getEstimatesForContact("cust-1", { page: 3, perPage: 50 });

    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      params: {
        customer_id: "cust-1",
        sort_column: "date",
        sort_order: "D",
        page: "3",
        per_page: "50",
      },
    });
  });

  it("returns estimates, page, and hasMore", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
      page_context: { has_more_page: true },
    });

    const result = await getEstimatesForContact("cust-1", { page: 2 });
    expect(result.estimates).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it("defaults hasMore to false when page_context is missing", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [sampleEstimate],
    });
    const result = await getEstimatesForContact("cust-1");
    expect(result.hasMore).toBe(false);
  });

  it("includes draft rows without filtering", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [{ ...sampleEstimate, status: "draft" }],
      page_context: { has_more_page: false },
    });
    const result = await getEstimatesForContact("cust-1");
    expect(result.estimates).toHaveLength(1);
    expect(result.estimates[0].status).toBe("draft");
  });

  it("throws on malformed Zoho response", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimates: [{ estimate_id: "missing-fields" }],
    });
    await expect(getEstimatesForContact("cust-1")).rejects.toThrow();
  });

  it("propagates Zoho errors", async () => {
    mockZohoFetch.mockRejectedValueOnce(new Error("Zoho 500"));
    await expect(getEstimatesForContact("cust-1")).rejects.toThrow("Zoho 500");
  });
});
