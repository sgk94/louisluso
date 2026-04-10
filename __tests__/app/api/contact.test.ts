import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/contact/route";

describe("POST /api/contact", () => {
  beforeEach(() => {
    mockSendEmail.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
  });

  it("sends email with valid data", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@example.com", subject: "General Inquiry", message: "Hello" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid data", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    const request = new Request("http://localhost/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@example.com", subject: "General Inquiry", message: "Hello" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
