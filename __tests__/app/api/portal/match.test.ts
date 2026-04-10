import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetContactByEmail } = vi.hoisted(() => ({ mockGetContactByEmail: vi.fn() }));
const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
const { mockCurrentUser } = vi.hoisted(() => ({ mockCurrentUser: vi.fn() }));
const { mockClerkClient } = vi.hoisted(() => ({
  mockClerkClient: { users: { updateUserMetadata: vi.fn() } },
}));

vi.mock("@/lib/zoho/crm", () => ({ getContactByEmail: mockGetContactByEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mockCurrentUser,
  clerkClient: vi.fn().mockResolvedValue(mockClerkClient),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]])),
}));

import { POST } from "@/app/api/portal/match/route";

describe("POST /api/portal/match", () => {
  beforeEach(() => {
    mockGetContactByEmail.mockReset();
    mockRateLimit.mockReset().mockResolvedValue({ success: true });
    mockCurrentUser.mockReset();
    mockClerkClient.users.updateUserMetadata.mockReset().mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("matches user email to Zoho contact and updates metadata", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-1",
      emailAddresses: [{ emailAddress: "dealer@store.com" }],
      publicMetadata: {},
    });
    mockGetContactByEmail.mockResolvedValue({
      id: "zoho-123",
      Account_Name: "Best Eye Care",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
    });

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.matched).toBe(true);
    expect(data.company).toBe("Best Eye Care");
    expect(mockClerkClient.users.updateUserMetadata).toHaveBeenCalledWith("user-1", {
      publicMetadata: {
        role: "partner",
        zohoContactId: "zoho-123",
        company: "Best Eye Care",
      },
    });
  });

  it("returns matched: false when no Zoho contact found", async () => {
    mockCurrentUser.mockResolvedValue({
      id: "user-2",
      emailAddresses: [{ emailAddress: "nobody@store.com" }],
      publicMetadata: {},
    });
    mockGetContactByEmail.mockResolvedValue(null);

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.matched).toBe(false);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });
    mockCurrentUser.mockResolvedValue({
      id: "user-3",
      emailAddresses: [{ emailAddress: "test@store.com" }],
      publicMetadata: {},
    });

    const request = new Request("http://localhost/api/portal/match", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
