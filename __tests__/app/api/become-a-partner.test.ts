import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateLead, mockAttachFile } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(), mockAttachFile: vi.fn(),
}));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("@/lib/zoho/crm", () => ({ createLead: mockCreateLead, attachFileToLead: mockAttachFile }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
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
});
