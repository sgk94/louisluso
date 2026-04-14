import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSearchLeads } = vi.hoisted(() => ({
  mockSearchLeads: vi.fn(),
}));

vi.mock("@/lib/zoho/crm", () => ({
  searchLeads: mockSearchLeads,
}));

import { buildCriteria, leadsToContacts } from "../../scripts/crm-pull-lib.js";

describe("buildCriteria", () => {
  it("builds Region criteria", () => {
    expect(buildCriteria({ region: "socal" })).toBe("(Region:equals:socal)");
  });

  it("builds State criteria", () => {
    expect(buildCriteria({ state: "TX" })).toBe("(State:equals:TX)");
  });

  it("builds City criteria", () => {
    expect(buildCriteria({ city: "Dallas" })).toBe("(City:equals:Dallas)");
  });

  it("throws when no filter provided", () => {
    expect(() => buildCriteria({})).toThrow("Provide --region, --state, or --city");
  });

  it("rejects region with injection characters", () => {
    expect(() => buildCriteria({ region: "socal)or(Email:starts_with:" })).toThrow("Invalid region slug");
  });

  it("rejects state with more than 2 letters", () => {
    expect(() => buildCriteria({ state: "TXX" })).toThrow("Invalid state");
  });

  it("rejects state with numbers", () => {
    expect(() => buildCriteria({ state: "T1" })).toThrow("Invalid state");
  });

  it("sanitizes city by stripping parens and colons", () => {
    expect(buildCriteria({ city: "Las Vegas" })).toBe("(City:equals:Las Vegas)");
  });

  it("rejects empty city after sanitization", () => {
    expect(() => buildCriteria({ city: "():" })).toThrow("City cannot be empty");
  });
});

describe("leadsToContacts", () => {
  it("converts CRM leads to Contact format", () => {
    const leads = [
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
        Lead_Source: "Business Card",
      },
    ];

    const contacts = leadsToContacts(leads);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toEqual({
      email: "jane@laoptical.com",
      name: "Jane Doe",
      company: "LA Optical",
      type: "",
      role: "",
      location: "Los Angeles, CA",
      tags: ["crm-import", "socal"],
      source: "zoho-crm",
      notes: "",
      status: "new",
      emailCount: 0,
      lastContacted: "",
      createdAt: expect.any(String),
    });
  });

  it("skips leads without email", () => {
    const leads = [
      {
        id: "lead-2",
        Company: "No Email Co",
        First_Name: "Bob",
        Last_Name: "X",
        Email: "",
        Phone: "555-0000",
      },
    ];

    const contacts = leadsToContacts(leads);
    expect(contacts).toHaveLength(0);
  });

  it("skips leads with null email", () => {
    const leads = [
      {
        id: "lead-4",
        Company: "Null Email Co",
        First_Name: "Sam",
        Last_Name: "N",
        Email: null,
        Phone: "555-0000",
      },
    ];

    const contacts = leadsToContacts(leads);
    expect(contacts).toHaveLength(0);
  });

  it("adds region tag when present", () => {
    const leads = [
      {
        id: "lead-3",
        Company: "DFW Eyes",
        First_Name: "Pat",
        Last_Name: "K",
        Email: "pat@dfweyes.com",
        Phone: "214-555-0100",
        Region: "dallas",
      },
    ];

    const contacts = leadsToContacts(leads);
    expect(contacts[0].tags).toContain("dallas");
  });
});
