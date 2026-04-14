import type { CRMLead } from "../lib/zoho/crm.js";
import type { Contact } from "../email/contacts.js";

export interface PullFilter {
  region?: string;
  state?: string;
  city?: string;
}

function sanitize(value: string): string {
  return value.replace(/[()":]/g, "").trim();
}

export function buildCriteria(filter: PullFilter): string {
  if (filter.region) {
    const val = sanitize(filter.region);
    if (!/^[a-z0-9-]+$/.test(val)) throw new Error(`Invalid region slug: ${val}`);
    return `(Region:equals:${val})`;
  }
  if (filter.state) {
    const val = sanitize(filter.state).toUpperCase();
    if (!/^[A-Z]{2}$/.test(val)) throw new Error(`Invalid state: ${val}`);
    return `(State:equals:${val})`;
  }
  if (filter.city) {
    const val = sanitize(filter.city);
    if (!val) throw new Error("City cannot be empty");
    return `(City:equals:${val})`;
  }
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
        email: (lead.Email ?? "").toLowerCase().trim(),
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
