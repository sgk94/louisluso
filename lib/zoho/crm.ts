import { zohoFetch } from "@/lib/zoho/client";
import { getAccessToken } from "@/lib/zoho/auth";
import { env } from "@/lib/env";

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
  Lead_Source?: string;
  Description?: string;
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
  const response = await zohoFetch<ContactsResponse>("/crm/v6/Contacts", {
    params: filters,
  });

  return response.data ?? [];
}

export async function getContactById(
  contactId: string,
): Promise<CRMContact> {
  const response = await zohoFetch<ContactByIdResponse>(
    `/crm/v6/Contacts/${contactId}`,
  );

  const contact = response.data?.[0];
  if (!contact) {
    throw new Error(`CRM contact not found: ${contactId}`);
  }

  return contact;
}

export async function attachFileToLead(
  leadId: string,
  file: Buffer,
  fileName: string,
): Promise<void> {
  const token = await getAccessToken();
  const url = `${env.ZOHO_API_BASE_URL}/crm/v6/Leads/${leadId}/Attachments`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(file)]);
  formData.append("file", blob, fileName);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `CRM attachFileToLead failed ${response.status}: ${errorBody}`,
    );
  }
}
