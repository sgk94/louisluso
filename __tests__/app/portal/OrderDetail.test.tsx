import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDetail } from "@/app/portal/quotes/[estimateNumber]/OrderDetail";
import { WORKFLOW_PROFILES } from "@/lib/portal/workflow";

const baseEstimate = {
  estimate_id: "est_1",
  estimate_number: "EST-001",
  customer_id: "cust_1",
  date: "2026-04-18",
  status: "sent" as const,
  total: 432.5,
  sub_total: 432.5,
  currency_code: "USD",
  line_items: [
    { line_item_id: "li_1", item_id: "item_1", name: "SP1018", sku: "SP1018-C2", quantity: 5, rate: 50, item_total: 250 },
    { line_item_id: "li_2", item_id: "item_2", name: "T-7241", sku: "T-7241-C8", quantity: 3, rate: 60.83, item_total: 182.5 },
  ],
};

describe("OrderDetail", () => {
  it("renders header with estimate number and submission date", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByRole("heading", { name: /EST-001/ })).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  it("does NOT render invoice section when no invoice exists", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.queryByText(/Invoice #/)).not.toBeInTheDocument();
  });

  it("renders invoice section with Pay + PDF buttons when invoice is sent and unpaid", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={{ invoice_id: "inv_1", invoice_number: "INV-1", status: "sent", total: 432.5, balance: 432.5, date: "2026-04-20", due_date: "2026-04-30", last_payment_date: null }}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
        zohoInvoiceUrl="https://books.zoho.com/pay/inv_1"
      />,
    );
    expect(screen.getByText(/INV-1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pay Invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download PDF/ })).toBeInTheDocument();
  });

  it("replaces pay buttons with Paid badge when invoice is paid", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={{ invoice_id: "inv_1", invoice_number: "INV-1", status: "paid", total: 432.5, balance: 0, date: "2026-04-20", due_date: "2026-04-30", last_payment_date: "2026-04-22" }}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByText(/Paid/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pay Invoice/ })).not.toBeInTheDocument();
  });

  it("renders shipping section with tracking when shipment exists", () => {
    render(
      <OrderDetail
        estimate={{ ...baseEstimate, status: "accepted" }}
        salesOrder={{ salesorder_id: "so_1", salesorder_number: "SO-1", customer_id: "cust_1", customer_name: "Acme", status: "confirmed", total: 432.5, line_items: [], date: "2026-04-19", created_time: "2026-04-19T10:00:00Z", packages: [] }}
        invoice={null}
        shipment={{ tracking_number: "1Z999AA10123456784", carrier: "UPS", date: "2026-04-24" }}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_xyz"
      />,
    );
    expect(screen.getByText(/Tracking/)).toBeInTheDocument();
    expect(screen.getByText(/1Z999AA10123456784/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Track Package/ })).toBeInTheDocument();
  });

  it("always renders the universal recovery footer with errorId", () => {
    render(
      <OrderDetail
        estimate={baseEstimate}
        salesOrder={null}
        invoice={null}
        shipment={null}
        profile={WORKFLOW_PROFILES.cash}
        errorId="req_abc123"
      />,
    );
    expect(screen.getByText(/req_abc123/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submit a quote without logging in/ })).toBeInTheDocument();
  });
});
