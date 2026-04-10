import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetContactById } = vi.hoisted(() => ({ mockGetContactById: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));

vi.mock("@/lib/zoho/crm", () => ({ getContactById: mockGetContactById }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mockCurrentUser }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { GET } from "@/app/api/portal/account/route";

describe("GET /api/portal/account", () => {
  beforeEach(() => {
    mockGetContactById.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when not a partner", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {},
    });
    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns account info for valid partner", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {
        role: "partner",
        zohoContactId: "zoho-123",
        company: "Best Eye Care",
      },
    });
    mockGetContactById.mockResolvedValue({
      id: "zoho-123",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
      Account_Name: "Best Eye Care",
      Phone: "555-1234",
      Mailing_Street: "123 Main St",
      Mailing_City: "Chicago",
      Mailing_State: "IL",
      Mailing_Zip: "60601",
    });

    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.company).toBe("Best Eye Care");
    expect(data.firstName).toBe("John");
    expect(data.lastName).toBe("Doe");
    expect(data.email).toBe("dealer@store.com");
    expect(data.phone).toBe("555-1234");
    expect(data.address.street).toBe("123 Main St");
  });

  it("returns 404 when Zoho contact not found", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      publicMetadata: {
        role: "partner",
        zohoContactId: "missing",
        company: "Test",
      },
    });
    mockGetContactById.mockRejectedValue(new Error("CRM contact not found: missing"));

    const request = new Request("http://localhost/api/portal/account");
    const response = await GET(request);
    expect(response.status).toBe(404);
  });
});
