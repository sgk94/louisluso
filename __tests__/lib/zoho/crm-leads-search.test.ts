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
    ZOHO_ORG_ID: "org-123",
  },
}));

import { searchLeads } from "@/lib/zoho/crm";

describe("searchLeads", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  it("searches by Region criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-1",
          Company: "LA Optical",
          First_Name: "Jane",
          Last_Name: "Doe",
          Email: "jane@laoptical.com",
          Phone: "310-555-0100",
          City: "Los Angeles",
          State: "CA",
          Zip_Code: "90001",
          Region: "socal",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(Region:equals:socal)");

    expect(leads).toHaveLength(1);
    expect(leads[0].Email).toBe("jane@laoptical.com");
    expect(mockZohoFetch).toHaveBeenCalledWith("/crm/v6/Leads/search", {
      params: { criteria: "(Region:equals:socal)", per_page: "200", page: "1" },
    });
  });

  it("searches by State criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-2",
          Company: "TX Eye",
          First_Name: "Bob",
          Last_Name: "Smith",
          Email: "bob@txeye.com",
          Phone: "214-555-0100",
          City: "Dallas",
          State: "TX",
          Zip_Code: "75201",
          Region: "dallas",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(State:equals:TX)");

    expect(leads).toHaveLength(1);
    expect(leads[0].Company).toBe("TX Eye");
  });

  it("searches by City criteria", async () => {
    mockZohoFetch.mockResolvedValueOnce({
      data: [
        {
          id: "lead-3",
          Company: "Austin Specs",
          First_Name: "Pat",
          Last_Name: "K",
          Email: "pat@austinspecs.com",
          Phone: "512-555-0100",
          City: "Austin",
          State: "TX",
          Zip_Code: "78701",
          Region: "austin",
        },
      ],
      info: { more_records: false },
    });

    const leads = await searchLeads("(City:equals:Austin)");

    expect(leads).toHaveLength(1);
  });

  it("returns empty array when no matches", async () => {
    mockZohoFetch.mockResolvedValueOnce({ data: null, info: { more_records: false } });

    const leads = await searchLeads("(Region:equals:nowhere)");

    expect(leads).toEqual([]);
  });

  it("paginates when more_records is true", async () => {
    mockZohoFetch
      .mockResolvedValueOnce({
        data: [{ id: "lead-p1", Company: "Page1 Co", First_Name: "A", Last_Name: "B", Email: "a@b.com", Phone: "555" }],
        info: { more_records: true },
      })
      .mockResolvedValueOnce({
        data: [{ id: "lead-p2", Company: "Page2 Co", First_Name: "C", Last_Name: "D", Email: "c@d.com", Phone: "555" }],
        info: { more_records: false },
      });

    const leads = await searchLeads("(Region:equals:socal)");

    expect(leads).toHaveLength(2);
    expect(leads[0].id).toBe("lead-p1");
    expect(leads[1].id).toBe("lead-p2");
    expect(mockZohoFetch).toHaveBeenCalledTimes(2);
    expect(mockZohoFetch).toHaveBeenNthCalledWith(1, "/crm/v6/Leads/search", {
      params: { criteria: "(Region:equals:socal)", per_page: "200", page: "1" },
    });
    expect(mockZohoFetch).toHaveBeenNthCalledWith(2, "/crm/v6/Leads/search", {
      params: { criteria: "(Region:equals:socal)", per_page: "200", page: "2" },
    });
  });
});
