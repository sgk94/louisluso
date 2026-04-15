import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import { getEstimateByNumber } from "@/lib/zoho/books";

const DETAIL = {
  estimate_id: "est-42",
  estimate_number: "EST-00042",
  customer_id: "cust-1",
  date: "2026-04-12",
  status: "sent",
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
  ],
};

describe("getEstimateByNumber", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("happy path: returns detail with line items", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: DETAIL });

    const result = await getEstimateByNumber("cust-1", "EST-00042");

    expect(result).not.toBeNull();
    expect(result?.estimate_number).toBe("EST-00042");
    expect(result?.line_items).toHaveLength(1);
    expect(result?.line_items[0].name).toBe("SG-1011");

    expect(mockZohoFetch).toHaveBeenNthCalledWith(1, "/books/v3/estimates", {
      params: { customer_id: "cust-1", estimate_number: "EST-00042" },
    });
    expect(mockZohoFetch).toHaveBeenNthCalledWith(2, "/books/v3/estimates/est-42");
  });

  it("returns null when filtered list is empty", async () => {
    mockZohoFetch.mockResolvedValueOnce({ estimates: [] });
    const result = await getEstimateByNumber("cust-1", "EST-99999");
    expect(result).toBeNull();
    expect(mockZohoFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when customer_id on returned detail does not match caller", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: { ...DETAIL, customer_id: "other-cust" } });

    const result = await getEstimateByNumber("cust-1", "EST-00042");
    expect(result).toBeNull();
  });

  it("throws on malformed detail response", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        estimates: [
          { estimate_id: "est-42", estimate_number: "EST-00042", customer_id: "cust-1" },
        ],
      })
      .mockResolvedValueOnce({ estimate: { estimate_id: "bad", estimate_number: "BAD" } });

    await expect(getEstimateByNumber("cust-1", "EST-00042")).rejects.toThrow();
  });

  it("propagates Zoho errors", async () => {
    mockZohoFetch.mockRejectedValueOnce(new Error("Zoho 500"));
    await expect(getEstimateByNumber("cust-1", "EST-00042")).rejects.toThrow("Zoho 500");
  });
});
