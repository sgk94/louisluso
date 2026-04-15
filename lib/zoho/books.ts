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
  if (Object.prototype.hasOwnProperty.call(ESTIMATE_STATUS_LABELS, status)) {
    return ESTIMATE_STATUS_LABELS[status];
  }
  if (status.length === 0) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
