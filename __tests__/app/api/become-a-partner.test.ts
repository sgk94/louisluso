import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateLead, mockAttachFile } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(), mockAttachFile: vi.fn(),
}));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));

vi.mock("@/lib/zoho/crm", () => ({ createLead: mockCreateLead, attachFileToLead: mockAttachFile }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/env", () => ({
  env: { PARTNER_APP_NOTIFY_EMAIL: "notify-test@example.com" },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/become-a-partner/route";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("POST /api/become-a-partner", () => {
  beforeEach(() => {
    mockCreateLead.mockReset().mockResolvedValue("lead-123");
    mockAttachFile.mockReset().mockResolvedValue(undefined);
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockSendEmail.mockReset().mockResolvedValue(undefined);
  });

  const validFields = {
    company: "Test Optical", contactName: "John Doe", email: "john@example.com",
    phone: "555-1234", address: "123 Main St", city: "Chicago", state: "IL",
    zip: "60601", referralSource: "Friend",
  };

  it("creates lead in Zoho CRM", async () => {
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST", body: makeFormData(validFields),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({ Company: "Test Optical", First_Name: "John", Last_Name: "Doe", Email: "john@example.com" }),
    );
  });

  it("returns 400 for missing company", async () => {
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST", body: makeFormData({ ...validFields, company: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST", body: makeFormData(validFields),
    });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it("sends notification email with applicant details, Reply-To set to applicant", async () => {
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST", body: makeFormData(validFields),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("notify-test@example.com");
    expect(args.replyTo).toBe("john@example.com");
    expect(args.subject).toBe("Partner Application — Test Optical");
    expect(args.body).toContain("Test Optical");
    expect(args.body).toContain("John Doe");
    expect(args.body).toContain("john@example.com");
    expect(args.body).toContain("lead-123");
    expect(args.body).toContain("not provided");
  });

  it("does not fail the request when notification email throws", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("gmail down"));
    const request = new Request("http://localhost/api/become-a-partner", {
      method: "POST", body: makeFormData(validFields),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
