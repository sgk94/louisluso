import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetContactById } = vi.hoisted(() => ({
  mockGetContactById: vi.fn(),
}));
const { mockSendPartnerInvite } = vi.hoisted(() => ({
  mockSendPartnerInvite: vi.fn(),
}));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockHeaders } = vi.hoisted(() => ({ mockHeaders: vi.fn() }));

vi.mock("@/lib/zoho/crm", () => ({ getContactById: mockGetContactById }));
vi.mock("@/lib/portal/invite", () => ({
  sendPartnerInvite: mockSendPartnerInvite,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitZohoWebhook: mockRateLimit,
}));
vi.mock("@/lib/env", () => ({
  env: { ZOHO_WEBHOOK_SECRET: "test-secret-that-is-at-least-32-chars-aaaa" },
}));
vi.mock("next/headers", () => ({ headers: mockHeaders }));

import { POST } from "@/app/api/zoho/webhooks/contact-created/route";

const VALID_CONTACT = {
  id: "contact-42",
  Email: "dealer@store.com",
  First_Name: "Jane",
  Last_Name: "Doe",
  Account_Name: "Doe Optical",
};

function makeHeaders(overrides: Record<string, string> = {}): Map<string, string> {
  const map = new Map([
    ["x-forwarded-for", "198.51.100.1"],
    ["x-zoho-webhook-token", "test-secret-that-is-at-least-32-chars-aaaa"],
    ...Object.entries(overrides),
  ]);
  return map;
}

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request(
    "http://localhost/api/zoho/webhooks/contact-created",
    {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

describe("POST /api/zoho/webhooks/contact-created", () => {
  beforeEach(() => {
    mockGetContactById.mockReset().mockResolvedValue(VALID_CONTACT);
    mockSendPartnerInvite.mockReset().mockResolvedValue({ dryRun: false });
    mockRateLimit.mockReset().mockResolvedValue({ success: true, remaining: 19 });
    mockHeaders.mockReset().mockResolvedValue(makeHeaders());
  });

  it("returns 429 when rate limited (even with valid secret)", async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(429);
    expect(mockGetContactById).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is missing", async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ "x-zoho-webhook-token": "" }));
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(401);
    expect(mockGetContactById).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is wrong", async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ "x-zoho-webhook-token": "wrong-secret-wrong-secret-wrong-secret" }),
    );
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(401);
    expect(mockGetContactById).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(makeRequest("{not valid json"));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 when contactId is missing", async () => {
    const response = await POST(makeRequest({ other: "field" }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when getContactById throws", async () => {
    mockGetContactById.mockRejectedValue(new Error("not found"));
    const response = await POST(makeRequest({ contactId: "missing" }));
    expect(response.status).toBe(404);
  });

  it("returns 422 when contact has no email", async () => {
    mockGetContactById.mockResolvedValue({ ...VALID_CONTACT, Email: "" });
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(422);
    expect(mockSendPartnerInvite).not.toHaveBeenCalled();
  });

  it("returns 502 when invite delivery fails", async () => {
    mockSendPartnerInvite.mockRejectedValue(new Error("gmail down"));
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(502);
  });

  it("returns 200 and triggers invite on happy path", async () => {
    const response = await POST(makeRequest({ contactId: "contact-42" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(mockGetContactById).toHaveBeenCalledWith("contact-42");
    expect(mockSendPartnerInvite).toHaveBeenCalledWith(VALID_CONTACT);
  });
});
