import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({ mockZohoFetch: vi.fn() }));

vi.mock("@/lib/zoho/client", () => ({ zohoFetch: mockZohoFetch }));

import { createEstimate } from "@/lib/zoho/books";

describe("createEstimate", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("creates an estimate and returns estimate number", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimate: {
        estimate_id: "est-1",
        estimate_number: "EST-00001",
      },
    });

    const result = await createEstimate("customer-1", [
      { item_id: "item-1", quantity: 5, rate: 76 },
    ]);

    expect(result.estimate_number).toBe("EST-00001");
    expect(result.estimate_id).toBe("est-1");
    expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/estimates", {
      method: "POST",
      body: {
        customer_id: "customer-1",
        line_items: [{ item_id: "item-1", quantity: 5, rate: 76 }],
      },
    });
  });

  it("includes notes when provided", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      estimate: { estimate_id: "est-2", estimate_number: "EST-00002" },
    });

    await createEstimate(
      "customer-1",
      [{ item_id: "item-1", quantity: 1, rate: 50 }],
      "Rush order",
    );

    const call = mockZohoFetch.mock.calls[0];
    expect(call[1].body.notes).toBe("Rush order");
  });
});
