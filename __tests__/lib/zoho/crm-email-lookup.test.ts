import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({
  mockZohoFetch: vi.fn(),
}));

vi.mock("@/lib/zoho/client", () => ({
  zohoFetch: mockZohoFetch,
}));

vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ZOHO_API_BASE_URL: "https://www.zohoapis.com",
    ZOHO_ORG_ID: "test-org",
  },
}));

import { getContactByEmail, type CRMContact } from "@/lib/zoho/crm";

describe("getContactByEmail", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("returns contact when found by email", async () => {
    const contact: CRMContact = {
      id: "c1",
      Email: "dealer@store.com",
      First_Name: "John",
      Last_Name: "Doe",
      Account_Name: "Best Eye Care",
      Phone: "555-1234",
      Mailing_Street: "123 Main St",
      Mailing_City: "Chicago",
      Mailing_State: "IL",
      Mailing_Zip: "60601",
    };

    mockZohoFetch.mockResolvedValueOnce({ data: [contact] });

    const result = await getContactByEmail("dealer@store.com");

    expect(result).toEqual(contact);
    expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Contacts/search", {
      params: { email: "dealer@store.com" },
    });
  });

  it("returns null when no contact matches", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: null });

    const result = await getContactByEmail("unknown@store.com");

    expect(result).toBeNull();
  });

  it("returns null when data is empty array", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: [] });

    const result = await getContactByEmail("unknown@store.com");

    expect(result).toBeNull();
  });

  it("rejects invalid email format", async () => {
    await expect(getContactByEmail("not-an-email")).rejects.toThrow("Invalid email");
  });
});
