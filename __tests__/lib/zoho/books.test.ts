import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({
  mockZohoFetch: vi.fn(),
}));

vi.mock("@/lib/zoho/client", () => ({
  zohoFetch: mockZohoFetch,
}));

import {
  createSalesOrder,
  getSalesOrders,
  getSalesOrder,
  getInvoicesForContact,
} from "@/lib/zoho/books";

describe("Zoho Books API", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  describe("createSalesOrder", () => {
    it("POSTs with correct body and returns the sales order", async () => {
      const input = {
        customer_id: "cust-1",
        line_items: [
          { item_id: "item-1", quantity: 2, rate: 50, name: "Frame A" },
        ],
        notes: "Rush order",
        reference_number: "REF-001",
      };

      const salesOrder = {
        salesorder_id: "so-1",
        salesorder_number: "SO-0001",
        customer_id: "cust-1",
        customer_name: "Test Customer",
        status: "open",
        total: 100,
        line_items: input.line_items,
        date: "2026-04-08",
        created_time: "2026-04-08T12:00:00.000Z",
      };

      mockZohoFetch.mockResolvedValueOnce({ salesorder: salesOrder });

      const result = await createSalesOrder(input);

      expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/salesorders", {
        method: "POST",
        body: {
          customer_id: "cust-1",
          line_items: input.line_items,
          notes: "Rush order",
          reference_number: "REF-001",
        },
      });
      expect(result).toEqual(salesOrder);
    });

    it("omits optional fields when not provided", async () => {
      const input = {
        customer_id: "cust-2",
        line_items: [{ item_id: "item-2", quantity: 1, rate: 75 }],
      };

      const salesOrder = {
        salesorder_id: "so-2",
        salesorder_number: "SO-0002",
        customer_id: "cust-2",
        customer_name: "Another Customer",
        status: "open",
        total: 75,
        line_items: input.line_items,
        date: "2026-04-08",
        created_time: "2026-04-08T12:00:00.000Z",
      };

      mockZohoFetch.mockResolvedValueOnce({ salesorder: salesOrder });

      const result = await createSalesOrder(input);

      expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/salesorders", {
        method: "POST",
        body: {
          customer_id: "cust-2",
          line_items: input.line_items,
        },
      });
      expect(result).toEqual(salesOrder);
    });
  });

  describe("getSalesOrders", () => {
    it("filters by customer_id and sorts by created_time desc", async () => {
      const salesOrders = [
        {
          salesorder_id: "so-2",
          salesorder_number: "SO-0002",
          customer_id: "cust-1",
          customer_name: "Test Customer",
          status: "open",
          total: 200,
          line_items: [],
          date: "2026-04-08",
          created_time: "2026-04-08T12:00:00.000Z",
        },
        {
          salesorder_id: "so-1",
          salesorder_number: "SO-0001",
          customer_id: "cust-1",
          customer_name: "Test Customer",
          status: "fulfilled",
          total: 100,
          line_items: [],
          date: "2026-04-07",
          created_time: "2026-04-07T12:00:00.000Z",
        },
      ];

      mockZohoFetch.mockResolvedValueOnce({ salesorders: salesOrders });

      const result = await getSalesOrders("cust-1");

      expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/salesorders", {
        params: {
          customer_id: "cust-1",
          sort_column: "created_time",
          sort_order: "D",
        },
      });
      expect(result).toEqual(salesOrders);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no sales orders exist", async () => {
      mockZohoFetch.mockResolvedValueOnce({ salesorders: [] });

      const result = await getSalesOrders("cust-none");

      expect(result).toEqual([]);
    });
  });

  describe("getSalesOrder", () => {
    it("fetches a single sales order by ID", async () => {
      const salesOrder = {
        salesorder_id: "so-1",
        salesorder_number: "SO-0001",
        customer_id: "cust-1",
        customer_name: "Test Customer",
        status: "open",
        total: 100,
        line_items: [{ item_id: "item-1", quantity: 2, rate: 50 }],
        date: "2026-04-08",
        created_time: "2026-04-08T12:00:00.000Z",
      };

      mockZohoFetch.mockResolvedValueOnce({ salesorder: salesOrder });

      const result = await getSalesOrder("so-1");

      expect(mockZohoFetch).toHaveBeenCalledWith(
        "/books/v3/salesorders/so-1",
      );
      expect(result).toEqual(salesOrder);
    });
  });

  describe("getInvoicesForContact", () => {
    it("returns invoices array filtered by customer_id", async () => {
      const invoices = [
        {
          invoice_id: "inv-2",
          invoice_number: "INV-0002",
          status: "sent",
          total: 200,
          balance: 200,
          date: "2026-04-08",
          due_date: "2026-05-08",
          invoice_url: "https://books.zoho.com/invoice/inv-2",
        },
        {
          invoice_id: "inv-1",
          invoice_number: "INV-0001",
          status: "paid",
          total: 100,
          balance: 0,
          date: "2026-04-07",
          due_date: "2026-05-07",
        },
      ];

      mockZohoFetch.mockResolvedValueOnce({ invoices });

      const result = await getInvoicesForContact("cust-1");

      expect(mockZohoFetch).toHaveBeenCalledWith("/books/v3/invoices", {
        params: {
          customer_id: "cust-1",
          sort_column: "created_time",
          sort_order: "D",
        },
      });
      expect(result).toEqual(invoices);
      expect(result).toHaveLength(2);
      expect(result[0].invoice_id).toBe("inv-2");
    });

    it("returns empty array when no invoices exist", async () => {
      mockZohoFetch.mockResolvedValueOnce({ invoices: [] });

      const result = await getInvoicesForContact("cust-none");

      expect(result).toEqual([]);
    });
  });
});
