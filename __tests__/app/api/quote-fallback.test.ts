import { describe, it, expect, vi, beforeEach } from "vitest";

const { rateLimitQuoteFallbackMock, sendEmailMock } = vi.hoisted(() => ({
  rateLimitQuoteFallbackMock: vi.fn().mockResolvedValue({ success: true, remaining: 4 }),
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimitQuoteFallback: rateLimitQuoteFallbackMock }));
vi.mock("@/lib/gmail", () => ({ sendEmail: sendEmailMock }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => "127.0.0.1",
  }),
}));

import { POST } from "@/app/api/quote-fallback/route";

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/quote-fallback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/quote-fallback", () => {
  beforeEach(() => {
    sendEmailMock.mockClear();
    rateLimitQuoteFallbackMock.mockClear();
    rateLimitQuoteFallbackMock.mockResolvedValue({ success: true, remaining: 4 });
  });

  const valid = {
    email: "p@acme.com",
    name: "Alice",
    company: "Acme Optics",
    products: "SP1018 in C2 × 5",
    notes: "asap please",
  };

  it("returns 400 on invalid JSON", async () => {
    const req = new Request("http://test/api/quote-fallback", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on schema failure with field-level errors", async () => {
    const res = await POST(makeRequest({ ...valid, email: "nope" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("details");
  });

  it("returns 200 + sends email on valid payload", async () => {
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe("cs@louisluso.com");
    expect(call.subject).toContain("Acme Optics");
    expect(call.body).toContain("SP1018 in C2 × 5");
  });

  it("returns 500 when Gmail send fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("gmail down"));
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limited", async () => {
    rateLimitQuoteFallbackMock.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(makeRequest(valid));
    expect(res.status).toBe(429);
  });

  it("returns 400 on CRLF injection attempt in company", async () => {
    const res = await POST(makeRequest({
      ...valid,
      company: "Acme\r\nBcc: attacker@example.com",
    }));
    expect(res.status).toBe(400);
  });
});
