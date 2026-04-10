import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitDealerContact: mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/dealers/[id]/contact/route";

function makeRequest(dealerId: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/dealers/${dealerId}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dealers/[id]/contact", () => {
  beforeEach(() => {
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
  });

  it("sends email to dealer with valid data", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "John Smith",
      customerEmail: "john@example.com",
      message: "Interested in SP1018",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("info@brillianteye.example.com");
    expect(call.replyTo).toBe("john@example.com");
    expect(call.bcc).toContain("admin@louisluso.com");
    expect(call.body).toContain("John Smith");
  });

  it("returns 400 for invalid data", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "",
      customerEmail: "bad-email",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown dealer", async () => {
    const request = makeRequest("dealer-999", {
      customerName: "John",
      customerEmail: "john@example.com",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-999" }) });
    expect(response.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    const request = makeRequest("dealer-001", {
      customerName: "John",
      customerEmail: "john@example.com",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(429);
  });

  it("includes product info in email when productSlug provided", async () => {
    const request = makeRequest("dealer-001", {
      customerName: "John Smith",
      customerEmail: "john@example.com",
      productSlug: "sp1018",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "dealer-001" }) });
    expect(response.status).toBe(200);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.body).toContain("sp1018");
    expect(call.body).toContain("louisluso.com/products/sp1018");
  });
});
