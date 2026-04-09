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
