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
  },
}));

import {
  createLead,
  getContacts,
  getContactById,
  type CRMLeadInput,
  type CRMContact,
} from "@/lib/zoho/crm";

describe("Zoho CRM API", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  describe("createLead", () => {
    it("posts lead data and returns lead ID", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        data: [
          {
            status: "success",
            details: { id: "lead-123" },
          },
        ],
      });

      const input: CRMLeadInput = {
        Company: "Acme Optical",
        First_Name: "John",
        Last_Name: "Doe",
        Email: "john@acme.com",
        Phone: "555-0100",
        Street: "123 Main St",
        City: "Columbus",
        State: "OH",
        Zip_Code: "43201",
      };

      const id = await createLead(input);

      expect(id).toBe("lead-123");
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads", {
        method: "POST",
        body: { data: [input] },
      });
    });

    it("includes optional fields when provided", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        data: [
          {
            status: "success",
            details: { id: "lead-456" },
          },
        ],
      });

      const input: CRMLeadInput = {
        Company: "Acme Optical",
        First_Name: "Jane",
        Last_Name: "Smith",
        Email: "jane@acme.com",
        Phone: "555-0200",
        Street: "456 Oak Ave",
        City: "Dallas",
        State: "TX",
        Zip_Code: "75201",
        Lead_Source: "Trade Show",
        Description: "Met at Vision Expo",
      };

      const id = await createLead(input);

      expect(id).toBe("lead-456");
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads", {
        method: "POST",
        body: { data: [input] },
      });
    });

    it("includes Region custom field when provided", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        data: [
          {
            status: "success",
            details: { id: "lead-789" },
          },
        ],
      });

      const input: CRMLeadInput = {
        Company: "Bay Area Vision",
        First_Name: "Kim",
        Last_Name: "Lee",
        Email: "kim@bayareavision.com",
        Phone: "415-555-0100",
        Street: "100 Market St",
        City: "San Francisco",
        State: "CA",
        Zip_Code: "94102",
        Region: "norcal",
        Lead_Source: "Business Card",
      };

      const id = await createLead(input);

      expect(id).toBe("lead-789");
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads", {
        method: "POST",
        body: { data: [input] },
      });
    });

    it("throws when API response status is not success", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        data: [
          {
            status: "error",
            message: "Duplicate lead",
          },
        ],
      });

      const input: CRMLeadInput = {
        Company: "Acme",
        First_Name: "A",
        Last_Name: "B",
        Email: "a@b.com",
        Phone: "555",
        Street: "1 St",
        City: "C",
        State: "OH",
        Zip_Code: "00000",
      };

      await expect(createLead(input)).rejects.toThrow(
        "CRM createLead failed",
      );
    });
  });

  describe("getContacts", () => {
    it("returns contacts array", async () => {
      const contacts: CRMContact[] = [
        {
          id: "c1",
          Email: "a@test.com",
          First_Name: "Alice",
          Last_Name: "A",
          Account_Name: "Test Co",
          Phone: "555-1111",
          Mailing_Street: "1 St",
          Mailing_City: "NYC",
          Mailing_State: "NY",
          Mailing_Zip: "10001",
        },
      ];

      mockZohoFetch.mockResolvedValueOnce({ data: contacts });

      const result = await getContacts();

      expect(result).toEqual(contacts);
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Contacts", {
        params: undefined,
      });
    });

    it("passes filter params when provided", async () => {
      mockZohoFetch.mockResolvedValueOnce({ data: [] });

      await getContacts({ fields: "Email,First_Name", per_page: "10" });

      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Contacts", {
        params: { fields: "Email,First_Name", per_page: "10" },
      });
    });

    it("returns empty array when data is null", async () => {
      mockZohoFetch.mockResolvedValueOnce({ data: null });

      const result = await getContacts();

      expect(result).toEqual([]);
    });

    it("returns empty array when data is undefined", async () => {
      mockZohoFetch.mockResolvedValueOnce({});

      const result = await getContacts();

      expect(result).toEqual([]);
    });
  });

  describe("getContactById", () => {
    it("returns a single contact", async () => {
      const contact: CRMContact = {
        id: "c1",
        Email: "bob@test.com",
        First_Name: "Bob",
        Last_Name: "B",
        Account_Name: "Bob Inc",
        Phone: "555-2222",
        Mailing_Street: "2 St",
        Mailing_City: "LA",
        Mailing_State: "CA",
        Mailing_Zip: "90001",
      };

      mockZohoFetch.mockResolvedValueOnce({ data: [contact] });

      const result = await getContactById("c1");

      expect(result).toEqual(contact);
      expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Contacts/c1");
    });

    it("throws when contact not found (no data)", async () => {
      mockZohoFetch.mockResolvedValueOnce({ data: [] });

      await expect(getContactById("missing")).rejects.toThrow(
        "CRM contact not found: missing",
      );
    });

    it("throws when data is null", async () => {
      mockZohoFetch.mockResolvedValueOnce({ data: null });

      await expect(getContactById("gone")).rejects.toThrow(
        "CRM contact not found: gone",
      );
    });
  });
});
