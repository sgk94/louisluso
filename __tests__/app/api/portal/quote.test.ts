import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEstimate } = vi.hoisted(() => ({ mockCreateEstimate: vi.fn() }));
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimitQuote } = vi.hoisted(() => ({ mockRateLimitQuote: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));
const { mockGetItems } = vi.hoisted(() => ({ mockGetItems: vi.fn() }));
const { mockRevalidateTag } = vi.hoisted(() => ({ mockRevalidateTag: vi.fn() }));

vi.mock("@/lib/zoho/books", () => ({ createEstimate: mockCreateEstimate, ESTIMATES_LIST_CACHE_TAG: "zoho-estimates-list" }));
vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitQuote: mockRateLimitQuote }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("@/lib/zoho/inventory", () => ({ getItems: mockGetItems }));
vi.mock("next/cache", () => ({ revalidateTag: mockRevalidateTag }));

import { POST } from "@/app/api/portal/quote/route";

const PARTNER_USER = {
  id: "u1",
  publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test Co" },
  emailAddresses: [{ emailAddress: "dealer@store.com" }],
} as const;

const ZOHO_ITEMS = [
  { item_id: "item-1", name: "Frame A", sku: "SKU-A", rate: 76, stock_on_hand: 100, status: "active" },
  { item_id: "item-2", name: "Frame B", sku: "SKU-B", rate: 88, stock_on_hand: 50, status: "active" },
];

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/portal/quote", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/portal/quote", () => {
  beforeEach(() => {
    mockCreateEstimate.mockReset().mockResolvedValue({
      estimate_id: "est-1",
      estimate_number: "EST-00001",
    });
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimitQuote.mockReset().mockResolvedValue({ success: true, remaining: 4 });
    mockCurrentUser.mockReset();
    mockGetItems.mockReset().mockResolvedValue(ZOHO_ITEMS);
    mockRevalidateTag.mockReset();
  });

  // --- auth / rate limit ---

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({ id: "u1", publicMetadata: {}, emailAddresses: [] });
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(403);
  });

  it("returns 429 when rate limited (checked after auth)", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    mockRateLimitQuote.mockResolvedValue({ success: false, remaining: 0 });
    const response = await POST(makeRequest({ items: [{ itemId: "item-1", quantity: 1, price: 76 }] }));
    expect(response.status).toBe(429);
    // rate limit must be keyed by user id, not IP
    expect(mockRateLimitQuote).toHaveBeenCalledWith("u1");
  });

  // --- request parsing ---

  it("returns 400 for malformed JSON", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    const response = await POST(makeRequest("{not valid json", "application/json"));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON");
    // should not reach Zoho at all
    expect(mockGetItems).not.toHaveBeenCalled();
    expect(mockCreateEstimate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid schema data", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  // --- server-side price validation ---

  it("returns 400 when itemId is not found in Zoho", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    const response = await POST(makeRequest({
      items: [{ itemId: "unknown-item", quantity: 1, price: 99 }],
    }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Item not found: unknown-item/);
    expect(mockCreateEstimate).not.toHaveBeenCalled();
  });

  it("uses server-side Zoho rate, not client-submitted price", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    // client submits price: 0.01 — should be ignored; Zoho rate is 76
    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 5, price: 0.01 }],
    }));
    expect(response.status).toBe(200);
    expect(mockCreateEstimate).toHaveBeenCalledWith(
      "z1",
      [{ item_id: "item-1", quantity: 5, rate: 76 }],
      undefined,
    );
  });

  // --- happy path ---

  it("creates estimate and sends confirmation email", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 5, price: 76 }],
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
    expect(mockCreateEstimate).toHaveBeenCalledWith(
      "z1",
      [{ item_id: "item-1", quantity: 5, rate: 76 }],
      undefined,
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("passes notes to createEstimate", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 2, price: 76 }],
      notes: "Rush order",
    }));
    expect(mockCreateEstimate).toHaveBeenCalledWith(
      "z1",
      expect.any(Array),
      "Rush order",
    );
  });

  // --- email best-effort ---

  it("returns success even when sendEmail throws (email is best-effort)", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    mockSendEmail.mockRejectedValue(new Error("Gmail API error"));

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));
    const data = await response.json();

    // estimate was created — that's the critical path
    expect(mockCreateEstimate).toHaveBeenCalledTimes(1);
    // email failed but response is still 200
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
  });

  // --- estimate failure ---

  it("returns 500 when createEstimate throws", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    mockCreateEstimate.mockRejectedValue(new Error("Zoho API error"));

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));
    expect(response.status).toBe(500);
    // email should not have been attempted
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // --- cache revalidation ---

  it("calls revalidateTag('zoho-estimates-list') after successful submission", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));

    expect(response.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith("zoho-estimates-list");
  });

  it("does not fail the submission when revalidateTag throws", async () => {
    mockCurrentUser.mockResolvedValue(PARTNER_USER);
    mockRevalidateTag.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 1, price: 76 }],
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
  });
});
