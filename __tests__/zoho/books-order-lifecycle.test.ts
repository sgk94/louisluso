import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import {
  getSalesOrderByReference,
  getInvoiceForSalesOrder,
} from "@/lib/zoho/books";

describe("getSalesOrderByReference", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns the matching sales order with packages parsed", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorders: [
            { salesorder_id: "so_1", reference_number: "EST-001" },
          ],
        }),
        { status: 200 },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          salesorder: {
            salesorder_id: "so_1",
            salesorder_number: "SO-1",
            customer_id: "cust_1",
            customer_name: "Acme",
            status: "confirmed",
            total: 100,
            line_items: [],
            date: "2026-04-19",
            created_time: "2026-04-19T10:00:00Z",
            packages: [
              {
                package_id: "pkg_1",
                package_number: "PKG-1",
                tracking_number: "1Z999AA1",
                delivery_method: "UPS",
                shipment_date: "2026-04-22",
                status: "shipped",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const so = await getSalesOrderByReference("cust_1", "EST-001");
    expect(so).not.toBeNull();
    expect(so?.salesorder_id).toBe("so_1");
    expect(so?.packages).toHaveLength(1);
    expect(so?.packages[0].tracking_number).toBe("1Z999AA1");
  });

  it("returns null when no matching reference_number found", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, salesorders: [] }), { status: 200 }),
    );
    expect(await getSalesOrderByReference("cust_1", "EST-404")).toBeNull();
  });
});

describe("getInvoiceForSalesOrder", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns the most-recent invoice linked to the sales order", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          invoices: [
            {
              invoice_id: "inv_1",
              invoice_number: "INV-1",
              status: "sent",
              total: 100,
              balance: 100,
              date: "2026-04-20",
              due_date: "2026-04-30",
              last_payment_date: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const inv = await getInvoiceForSalesOrder("so_1");
    expect(inv?.invoice_id).toBe("inv_1");
    expect(inv?.last_payment_date).toBeNull();
  });

  it("returns null when no invoice exists yet", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, invoices: [] }), { status: 200 }),
    );
    expect(await getInvoiceForSalesOrder("so_1")).toBeNull();
  });
});
