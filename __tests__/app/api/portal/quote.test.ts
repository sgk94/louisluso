import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEstimate } = vi.hoisted(() => ({ mockCreateEstimate: vi.fn() }));
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/books", () => ({ createEstimate: mockCreateEstimate }));
vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/portal/quote/route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/portal/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal/quote", () => {
  beforeEach(() => {
    mockCreateEstimate.mockReset().mockResolvedValue({
      estimate_id: "est-1",
      estimate_number: "EST-00001",
    });
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

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

  it("returns 400 for invalid data", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
      emailAddresses: [{ emailAddress: "test@store.com" }],
    });
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  it("creates estimate and sends email", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test Co" },
      emailAddresses: [{ emailAddress: "dealer@store.com" }],
    });
    const response = await POST(makeRequest({
      items: [{ itemId: "item-1", quantity: 5, price: 76 }],
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.estimateNumber).toBe("EST-00001");
    expect(mockCreateEstimate).toHaveBeenCalledWith("z1", [
      { item_id: "item-1", quantity: 5, rate: 76 },
    ], undefined);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "u1",
      publicMetadata: { role: "partner", zohoContactId: "z1", company: "Test" },
      emailAddresses: [{ emailAddress: "test@store.com" }],
    });
    const response = await POST(makeRequest({ items: [{ itemId: "i", quantity: 1, price: 1 }] }));
    expect(response.status).toBe(429);
  });
});
