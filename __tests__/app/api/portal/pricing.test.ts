import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetPriceBook } = vi.hoisted(() => ({ mockGetPriceBook: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/inventory", () => ({ getPriceBook: mockGetPriceBook }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { GET } from "@/app/api/portal/pricing/route";

function makeRequest(items: string): Request {
  return new Request(`http://localhost/api/portal/pricing?items=${items}`);
}

describe("GET /api/portal/pricing", () => {
  beforeEach(() => {
    mockGetPriceBook.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const response = await GET(makeRequest("item-1,item-2"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({ id: "u1", publicMetadata: {} });
    const response = await GET(makeRequest("item-1,item-2"));
    expect(response.status).toBe(403);
  });

  it("returns type 'listing' when partner has no pricingPlanId", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
    });
    const response = await GET(makeRequest("item-1"));
    const data = await response.json();
    expect(data.type).toBe("listing");
  });

  it("returns bespoke prices when partner has pricingPlanId", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test", pricingPlanId: "pb-1" },
    });
    mockGetPriceBook.mockResolvedValue({
      pricebook_id: "pb-1",
      name: "Wholesale 20%",
      pricebook_items: [
        { item_id: "item-1", pricebook_rate: 60 },
        { item_id: "item-2", pricebook_rate: 65 },
        { item_id: "item-99", pricebook_rate: 100 },
      ],
    });
    const response = await GET(makeRequest("item-1,item-2"));
    const data = await response.json();
    expect(data.type).toBe("bespoke");
    expect(data.prices["item-1"]).toBe(60);
    expect(data.prices["item-2"]).toBe(65);
    expect(data.prices["item-99"]).toBeUndefined();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
    });
    const response = await GET(makeRequest("item-1"));
    expect(response.status).toBe(429);
  });
});
