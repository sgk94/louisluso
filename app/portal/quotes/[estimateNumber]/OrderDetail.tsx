import Link from "next/link";
import type {
  ZohoEstimateDetail,
  ZohoSalesOrderDetail,
  ZohoInvoiceForOrder,
  OrderShipment,
} from "@/lib/zoho/books";
import { computeStages, type WorkflowProfile } from "@/lib/portal/workflow";
import { formatPrice } from "@/lib/catalog/format";
import { StatusTracker } from "./StatusTracker";

interface Props {
  estimate: ZohoEstimateDetail;
  salesOrder: ZohoSalesOrderDetail | null;
  invoice: ZohoInvoiceForOrder | null;
  shipment: OrderShipment | null;
  profile: WorkflowProfile;
  errorId: string;
  zohoInvoiceUrl?: string; // optional, real URL filled in by 5d.3
}

const CARRIER_TRACKING_URLS: Record<string, (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
};

function trackingUrl(carrier: string, tracking: string): string {
  const fn =
    CARRIER_TRACKING_URLS[carrier] ??
    ((n: string) => `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${n}`)}`);
  return fn(tracking);
}

export function OrderDetail({
  estimate,
  salesOrder,
  invoice,
  shipment,
  profile,
  errorId,
  zohoInvoiceUrl,
}: Props): React.ReactElement {
  const stages = computeStages(profile, {
    estimate: { date: estimate.date, status: estimate.status },
    salesOrder: salesOrder ? { created_time: salesOrder.created_time } : null,
    invoice: invoice
      ? {
          date: invoice.date,
          status: invoice.status,
          total: invoice.total,
          last_payment_date: invoice.last_payment_date ?? null,
        }
      : null,
    shipment,
  });

  const itemCount = estimate.line_items.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl text-white">Quote #{estimate.estimate_number}</h1>

        <div className="mt-10">
          <StatusTracker stages={stages} />
        </div>

        {invoice && (
          <section className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-heading text-lg text-white">Invoice #{invoice.invoice_number}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Amount: {formatPrice(invoice.total)}
              {invoice.due_date ? ` • Due: ${invoice.due_date}` : ""}
            </p>
            {invoice.status === "paid" ? (
              <p className="mt-3 text-sm text-bronze">✓ Paid {invoice.last_payment_date ?? ""}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {zohoInvoiceUrl && (
                  <a
                    href={zohoInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-bronze px-4 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
                  >
                    Pay Invoice
                  </a>
                )}
                <a
                  href={`https://books.zoho.com/app/invoices/${invoice.invoice_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-white/15 px-4 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
                >
                  Download PDF
                </a>
              </div>
            )}
          </section>
        )}

        {shipment && (
          <section className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-heading text-lg text-white">Shipped {shipment.date}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Tracking: {shipment.tracking_number} ({shipment.carrier})
            </p>
            <a
              href={trackingUrl(shipment.carrier, shipment.tracking_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block border border-bronze px-4 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
            >
              Track Package
            </a>
          </section>
        )}

        <section className="mt-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
                <th className="pb-3">Product</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3 text-right">Unit</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {estimate.line_items.map((li) => (
                <tr key={li.line_item_id} className="border-b border-white/5">
                  <td className="py-3 text-gray-200">{li.name}</td>
                  <td className="py-3 text-gray-500">{li.sku ?? "—"}</td>
                  <td className="py-3 text-center text-gray-400">{li.quantity}</td>
                  <td className="py-3 text-right text-gray-400">{formatPrice(li.rate)}</td>
                  <td className="py-3 text-right text-gray-200">{formatPrice(li.item_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-right text-sm">
            <p className="text-gray-500">{itemCount} items</p>
            <p className="mt-1 font-semibold text-white">Subtotal {formatPrice(estimate.sub_total)}</p>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <a
            href={`mailto:cs@louisluso.com?subject=Question%20about%20quote%20${encodeURIComponent(estimate.estimate_number)}`}
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Email Ken about this quote
          </a>
          <Link
            href="/eyeglasses"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <Link
            href="/portal/quotes"
            className="border border-white/10 px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-gray-400 hover:border-white/20 hover:text-white"
          >
            My Quotes
          </Link>
        </div>

        <footer className="mt-16 border-t border-white/5 pt-6 text-center text-xs text-gray-500">
          Need help? Email{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>{" "}
          or{" "}
          <Link href="/quote-fallback" className="text-bronze hover:underline">
            submit a quote without logging in
          </Link>
          . Reference: <code className="text-gray-400">{errorId}</code>
        </footer>
      </div>
    </main>
  );
}
