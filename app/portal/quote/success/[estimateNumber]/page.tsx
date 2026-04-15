import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { getEstimateByNumber } from "@/lib/zoho/books";
import { formatPrice } from "@/lib/catalog/format";

export const metadata = {
  title: "Quote Submitted | LOUISLUSO",
};

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  if (!user) {
    return <ErrorShell message="Account setup incomplete, contact support." />;
  }

  const meta = isPartner(user.publicMetadata) ? user.publicMetadata : null;
  if (!meta?.zohoContactId) {
    return <ErrorShell message="Account setup incomplete, contact support." />;
  }

  const { estimateNumber } = await params;

  let estimate;
  try {
    estimate = await getEstimateByNumber(meta.zohoContactId, estimateNumber);
  } catch (err) {
    console.error(
      `Failed to fetch estimate ${estimateNumber} for ${meta.zohoContactId}:`,
      err,
    );
    return (
      <ErrorShell message="Unable to load quote right now. Please try again in a moment." />
    );
  }

  if (!estimate) {
    console.warn(
      `Estimate not found for partner=${meta.zohoContactId} number=${estimateNumber}`,
    );
    return (
      <CenteredShell>
        <h2 className="font-heading text-2xl text-white">
          We couldn&apos;t find that quote.
        </h2>
        <p className="mt-4 text-sm text-gray-400">
          It may still be processing.
        </p>
        <Link
          href="/portal/quotes"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          View My Quotes
        </Link>
      </CenteredShell>
    );
  }

  const itemCount = estimate.line_items.reduce(
    (sum, li) => sum + li.quantity,
    0,
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-heading text-3xl text-white">Quote Submitted</h1>
        <p className="mt-4 text-sm text-gray-400">
          Quote {estimate.estimate_number} — Ken will review and confirm
          availability shortly.
        </p>

        <div className="mt-12 text-left">
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
                  <td className="py-3 text-center text-gray-400">
                    {li.quantity}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {formatPrice(li.rate)}
                  </td>
                  <td className="py-3 text-right text-gray-200">
                    {formatPrice(li.item_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-right text-sm">
            <p className="text-gray-500">{itemCount} items</p>
            <p className="mt-1 font-semibold text-white">
              Subtotal {formatPrice(estimate.sub_total)}
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/eyeglasses"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <Link
            href="/portal/quotes"
            className="border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            My Quotes
          </Link>
          <Link
            href="/portal"
            className="border border-white/10 px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function CenteredShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">{children}</div>
    </main>
  );
}

function ErrorShell({ message }: { message: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <p className="max-w-md text-center text-sm text-gray-400">{message}</p>
    </main>
  );
}
