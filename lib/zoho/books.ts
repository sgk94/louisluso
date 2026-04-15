import { unstable_cache } from "next/cache";
import { z } from "zod";
import { zohoFetch } from "@/lib/zoho/client";

const zohoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid Zoho ID");

export interface LineItem {
  item_id: string;
  quantity: number;
  rate: number;
  name?: string;
  sku?: string;
}

export interface CreateSalesOrderInput {
  customer_id: string;
  line_items: LineItem[];
  notes?: string;
  reference_number?: string;
}

export interface ZohoSalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  total: number;
  line_items: LineItem[];
  date: string;
  created_time: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total: number;
  balance: number;
  date: string;
  due_date: string;
  invoice_url?: string;
}

interface SalesOrderResponse {
  salesorder: ZohoSalesOrder;
}

interface SalesOrdersResponse {
  salesorders: ZohoSalesOrder[];
}

interface InvoicesResponse {
  invoices: ZohoInvoice[];
}

export async function createSalesOrder(
  input: CreateSalesOrderInput,
): Promise<ZohoSalesOrder> {
  const body: Record<string, unknown> = {
    customer_id: input.customer_id,
    line_items: input.line_items,
  };

  if (input.notes !== undefined) {
    body.notes = input.notes;
  }
  if (input.reference_number !== undefined) {
    body.reference_number = input.reference_number;
  }

  const response = await zohoFetch<SalesOrderResponse>(
    "/books/v3/salesorders",
    { method: "POST", body },
  );
  return response.salesorder;
}

export async function getSalesOrders(
  customerId: string,
): Promise<ZohoSalesOrder[]> {
  const response = await zohoFetch<SalesOrdersResponse>(
    "/books/v3/salesorders",
    {
      params: {
        customer_id: customerId,
        sort_column: "created_time",
        sort_order: "D",
      },
    },
  );
  return response.salesorders;
}

export async function getSalesOrder(
  salesOrderId: string,
): Promise<ZohoSalesOrder> {
  const parsed = zohoIdSchema.safeParse(salesOrderId);
  if (!parsed.success) throw new Error("Invalid sales order ID");

  const response = await zohoFetch<SalesOrderResponse>(
    `/books/v3/salesorders/${parsed.data}`,
  );
  return response.salesorder;
}

export async function getInvoicesForContact(
  customerId: string,
): Promise<ZohoInvoice[]> {
  const response = await zohoFetch<InvoicesResponse>("/books/v3/invoices", {
    params: {
      customer_id: customerId,
      sort_column: "created_time",
      sort_order: "D",
    },
  });
  return response.invoices;
}

export interface ZohoEstimate {
  estimate_id: string;
  estimate_number: string;
}

interface EstimateResponse {
  estimate: ZohoEstimate;
}

export async function createEstimate(
  customerId: string,
  lineItems: LineItem[],
  notes?: string,
): Promise<ZohoEstimate> {
  const body: Record<string, unknown> = {
    customer_id: customerId,
    line_items: lineItems,
  };

  if (notes !== undefined) {
    body.notes = notes;
  }

  const response = await zohoFetch<EstimateResponse>(
    "/books/v3/estimates",
    { method: "POST", body },
  );
  return response.estimate;
}

export interface ZohoEstimateListItem {
  estimate_id: string;
  estimate_number: string;
  date: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "invoiced";
  total: number;
  currency_code: string;
}

export interface EstimateListOptions {
  page?: number;
  perPage?: number;
}

export interface EstimateListResult {
  estimates: ZohoEstimateListItem[];
  page: number;
  hasMore: boolean;
}

const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "Pending Review",
  sent: "Pending Review",
  accepted: "Confirmed",
  declined: "Declined",
  expired: "Expired",
  invoiced: "Order Placed",
};

export function partnerLabelForEstimateStatus(status: string): string {
  if (status in ESTIMATE_STATUS_LABELS) {
    return ESTIMATE_STATUS_LABELS[status];
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const estimateListItemSchema = z.object({
  estimate_id: z.string(),
  estimate_number: z.string(),
  date: z.string(),
  status: z.enum([
    "draft",
    "sent",
    "accepted",
    "declined",
    "expired",
    "invoiced",
  ]),
  total: z.number(),
  currency_code: z.string(),
});

const estimatesListResponseSchema = z.object({
  estimates: z.array(estimateListItemSchema),
  page_context: z
    .object({
      has_more_page: z.boolean().optional(),
    })
    .optional(),
});

export async function getEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 20;

  const response = await zohoFetch<unknown>("/books/v3/estimates", {
    params: {
      customer_id: customerId,
      // Sort by estimate date, not created_time — matches the partner's mental
      // model ("newest quote first") and is the canonical Zoho-supported sort
      // field for the estimates endpoint.
      sort_column: "date",
      sort_order: "D",
      page: String(page),
      per_page: String(perPage),
    },
  });

  const parsed = estimatesListResponseSchema.parse(response);

  return {
    estimates: parsed.estimates,
    page,
    hasMore: parsed.page_context?.has_more_page ?? false,
  };
}

export const ESTIMATES_LIST_CACHE_TAG = "zoho-estimates-list";

const estimateDetailLineItemSchema = z.object({
  line_item_id: z.string(),
  item_id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number(),
  rate: z.number(),
  item_total: z.number(),
});

const estimateDetailSchema = z.object({
  estimate_id: z.string(),
  estimate_number: z.string(),
  customer_id: z.string(),
  date: z.string(),
  status: z.enum(["draft", "sent", "accepted", "declined", "expired", "invoiced"]),
  total: z.number(),
  sub_total: z.number(),
  currency_code: z.string(),
  line_items: z.array(estimateDetailLineItemSchema),
});

const estimateDetailResponseSchema = z.object({
  estimate: estimateDetailSchema,
});

const estimateSearchResponseSchema = z.object({
  estimates: z.array(
    z.object({
      estimate_id: z.string(),
      estimate_number: z.string(),
      customer_id: z.string(),
    }),
  ),
});

export type ZohoEstimateDetail = z.infer<typeof estimateDetailSchema>;

export async function getEstimateByNumber(
  customerId: string,
  estimateNumber: string,
): Promise<ZohoEstimateDetail | null> {
  const searchResponse = await zohoFetch<unknown>("/books/v3/estimates", {
    params: {
      customer_id: customerId,
      estimate_number: estimateNumber,
    },
  });
  const searchParsed = estimateSearchResponseSchema.parse(searchResponse);
  const match = searchParsed.estimates.find(
    (e) => e.estimate_number === estimateNumber && e.customer_id === customerId,
  );
  if (!match) return null;

  const detailResponse = await zohoFetch<unknown>(
    `/books/v3/estimates/${match.estimate_id}`,
  );
  const detailParsed = estimateDetailResponseSchema.parse(detailResponse);

  if (detailParsed.estimate.customer_id !== customerId) return null;

  return detailParsed.estimate;
}

const cachedGetEstimatesForContact = unstable_cache(
  async (customerId: string, page: number, perPage: number) => {
    return getEstimatesForContact(customerId, { page, perPage });
  },
  ["zoho-estimates-list"],
  {
    tags: [ESTIMATES_LIST_CACHE_TAG],
    revalidate: 60,
  },
);

export function getCachedEstimatesForContact(
  customerId: string,
  options?: EstimateListOptions,
): Promise<EstimateListResult> {
  return cachedGetEstimatesForContact(
    customerId,
    options?.page ?? 1,
    options?.perPage ?? 20,
  );
}

export interface ZohoBooksAddress {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface ZohoBooksContactPerson {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

export interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  notes?: string;
  billing_address?: ZohoBooksAddress;
  shipping_address?: ZohoBooksAddress;
  contact_persons?: ZohoBooksContactPerson[];
  status: string;
  [key: string]: unknown;
}

interface BooksContactsPageResponse {
  contacts?: ZohoBooksContact[];
  page_context?: { has_more_page?: boolean; page?: number };
}

const BOOKS_CUSTOMER_MAX_PAGES = 200;

export async function getAllBooksCustomers(): Promise<ZohoBooksContact[]> {
  const all: ZohoBooksContact[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    if (page > BOOKS_CUSTOMER_MAX_PAGES) {
      throw new Error(
        `getAllBooksCustomers: exceeded MAX_PAGES=${BOOKS_CUSTOMER_MAX_PAGES} (${BOOKS_CUSTOMER_MAX_PAGES * 200} contacts ceiling)`,
      );
    }
    const res = await zohoFetch<BooksContactsPageResponse>("/books/v3/contacts", {
      params: { contact_type: "customer", page: String(page), per_page: "200" },
    });
    all.push(...(res.contacts ?? []));
    hasMore = res.page_context?.has_more_page ?? false;
    page += 1;
  }
  return all;
}

export interface BooksCustomFieldPatch {
  api_name: string;
  value: string;
}

export interface BooksContactPatch {
  company_name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  shipping_address?: Partial<ZohoBooksAddress>;
  custom_fields?: BooksCustomFieldPatch[];
}

export async function updateBooksContact(
  contactId: string,
  patch: BooksContactPatch,
): Promise<void> {
  const parsed = zohoIdSchema.safeParse(contactId);
  if (!parsed.success) {
    throw new Error("Invalid contact ID");
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("updateBooksContact: patch must not be empty");
  }
  await zohoFetch(`/books/v3/contacts/${parsed.data}`, {
    method: "PUT",
    body: patch as unknown as Record<string, unknown>,
  });
}

interface BooksContactDetailResponse {
  contact?: ZohoBooksContact;
}

export async function getBooksContact(
  contactId: string,
): Promise<ZohoBooksContact> {
  const parsed = zohoIdSchema.safeParse(contactId);
  if (!parsed.success) {
    throw new Error("Invalid contact ID");
  }
  const res = await zohoFetch<BooksContactDetailResponse>(
    `/books/v3/contacts/${parsed.data}`,
  );
  if (!res.contact) {
    throw new Error(`Books contact ${parsed.data} not found`);
  }
  return res.contact;
}
