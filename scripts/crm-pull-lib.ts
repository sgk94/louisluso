import type { CRMLead } from "../lib/zoho/crm.js";
import type { Contact } from "../email/contacts.js";

export interface PullFilter {
  region?: string;
  state?: string;
  city?: string;
}

export function buildCriteria(filter: PullFilter): string {
  if (filter.region) return `(Region:equals:${filter.region})`;
  if (filter.state) return `(State:equals:${filter.state})`;
  if (filter.city) return `(City:equals:${filter.city})`;
  throw new Error("Provide --region, --state, or --city");
}

export function leadsToContacts(leads: CRMLead[]): Contact[] {
  const now = new Date().toISOString();

  return leads
    .filter((lead) => lead.Email)
    .map((lead) => {
      const tags = ["crm-import"];
      if (lead.Region) tags.push(String(lead.Region));

      const locationParts = [lead.City, lead.State].filter(Boolean);

      return {
        email: String(lead.Email).toLowerCase().trim(),
        name: `${lead.First_Name ?? ""} ${lead.Last_Name ?? ""}`.trim(),
        company: String(lead.Company ?? ""),
        type: "",
        role: "",
        location: locationParts.join(", "),
        tags,
        source: "zoho-crm",
        notes: "",
        status: "new",
        emailCount: 0,
        lastContacted: "",
        createdAt: now,
      };
    });
}
