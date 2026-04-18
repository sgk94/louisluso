import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import { getOrderLifecycle } from "@/lib/zoho/books";

describe("getOrderLifecycle — customer isolation", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns null when an estimate exists but belongs to a different customer", async () => {
    // Search returns the estimate (Zoho's filter on customer_id is honored,
    // but if a partner crafts a URL bypassing the filter, the search can still
    // surface it). The detail endpoint then exposes the true customer_id.
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimates: [
            { estimate_id: "est_x", estimate_number: "EST-OTHER", customer_id: "other_cust" },
          ],
        }),
        { status: 200 },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          estimate: {
            estimate_id: "est_x",
            estimate_number: "EST-OTHER",
            customer_id: "other_cust",
            date: "2026-04-18",
            status: "sent",
            total: 100,
            sub_total: 100,
            currency_code: "USD",
            line_items: [],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getOrderLifecycle("attacker_cust", "EST-OTHER");
    expect(result).toBeNull();
  });
});
