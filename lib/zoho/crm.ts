import { z } from "zod";
import { zohoFetch } from "@/lib/zoho/client";
import { getAccessToken } from "@/lib/zoho/auth";
import { env } from "@/lib/env";
import path from "path";

const zohoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid Zoho ID");

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

const ALLOWED_CONTACT_FILTER_KEYS = new Set([
  "fields",
  "per_page",
  "page",
  "sort_by",
  "sort_order",
  "type",
]);

export interface CRMLeadInput {
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street: string;
  City: string;
  State: string;
  Zip_Code: string;
  Country?: string;
  Region?: string;
  Lead_Source?: string;
  Description?: string;
}

export interface CRMLead {
  id: string;
  Company: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Street?: string;
  City?: string;
  State?: string;
  Zip_Code?: string;
  Region?: string;
  Lead_Source?: string;
  Description?: string;
  [key: string]: unknown;
}

interface SearchLeadsResponse {
  data: CRMLead[] | null;
  info: { more_records: boolean };
}

export interface CRMContact {
  id: string;
  Email: string;
  First_Name: string;
  Last_Name: string;
  Account_Name: string;
  Phone: string;
  Mailing_Street: string;
  Mailing_City: string;
  Mailing_State: string;
  Mailing_Zip: string;
  [key: string]: unknown;
}

interface CreateLeadResponse {
  data: Array<{
    status: string;
    details: { id: string };
    message?: string;
  }>;
}

interface ContactsResponse {
  data: CRMContact[] | null;
}

interface ContactByIdResponse {
  data: CRMContact[] | null;
}

export async function createLead(input: CRMLeadInput): Promise<string> {
  const response = await zohoFetch<CreateLeadResponse>("/crm/v6/Leads", {
    method: "POST",
    body: { data: [input] } as unknown as Record<string, unknown>,
  });

  const record = response.data[0];
  if (record.status !== "success") {
    throw new Error(
      `CRM createLead failed: ${record.message ?? record.status}`,
    );
  }

  return record.details.id;
}

export async function getContacts(
  filters?: Record<string, string>,
): Promise<CRMContact[]> {
  const sanitizedFilters: Record<string, string> = {};
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_CONTACT_FILTER_KEYS.has(key)) {
        sanitizedFilters[key] = value;
      }
    }
  }

  const response = await zohoFetch<ContactsResponse>("/crm/v6/Contacts", {
    params: Object.keys(sanitizedFilters).length > 0 ? sanitizedFilters : undefined,
  });

  return response.data ?? [];
}

export async function getContactById(
  contactId: string,
): Promise<CRMContact> {
  const parsed = zohoIdSchema.safeParse(contactId);
  if (!parsed.success) {
    throw new Error("Invalid contact ID");
  }

  const response = await zohoFetch<ContactByIdResponse>(
    `/crm/v6/Contacts/${parsed.data}`,
  );

  const contact = response.data?.[0];
  if (!contact) {
    throw new Error(`CRM contact not found: ${contactId}`);
  }

  return contact;
}

export async function getContactByEmail(
  email: string,
): Promise<CRMContact | null> {
  const emailCheck = z.string().email().safeParse(email);
  if (!emailCheck.success) {
    throw new Error("Invalid email");
  }

  const response = await zohoFetch<ContactsResponse>(
    "/crm/v6/Contacts/search",
    { params: { email } },
  );

  const contact = response.data?.[0];
  return contact ?? null;
}

export async function searchLeads(criteria: string): Promise<CRMLead[]> {
  const response = await zohoFetch<SearchLeadsResponse>("/crm/v6/Leads/search", {
    params: { criteria, per_page: "200" },
  });

  return response.data ?? [];
}

export async function attachFileToLead(
  leadId: string,
  file: Uint8Array,
  fileName: string,
): Promise<void> {
  const parsedId = zohoIdSchema.safeParse(leadId);
  if (!parsedId.success) {
    throw new Error("Invalid lead ID");
  }

  if (file.length === 0) {
    throw new Error("Empty file");
  }
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const sanitizedName = path.basename(fileName);
  const ext = path.extname(sanitizedName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  const token = await getAccessToken();
  const url = `${env.ZOHO_API_BASE_URL}/crm/v6/Leads/${parsedId.data}/Attachments`;

  const formData = new FormData();
  const blob = new Blob([file as unknown as BlobPart]);
  formData.append("file", blob, sanitizedName);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "X-com-zoho-crm-organizationid": env.ZOHO_ORG_ID,
    },
    body: formData,
  });

  if (!response.ok) {
    console.error(`CRM attachFileToLead failed: ${response.status}`);
    throw new Error("Failed to attach file to lead");
  }
}
