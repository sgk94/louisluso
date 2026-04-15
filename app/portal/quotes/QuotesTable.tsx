import Link from "next/link";
import { formatPrice } from "@/lib/catalog/format";
import {
  partnerLabelForEstimateStatus,
  type ZohoEstimateListItem,
} from "@/lib/zoho/books";

interface Props {
  estimates: ZohoEstimateListItem[];
  page: number;
  hasMore: boolean;
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  "Pending Review": "bg-white/5 text-gray-300",
  Confirmed: "bg-bronze/15 text-bronze",
  "Order Placed": "bg-green-500/15 text-green-400",
  Declined: "bg-red-500/10 text-red-400",
  Expired: "bg-white/5 text-gray-500",
};

function pillClass(label: string): string {
  return STATUS_PILL_CLASSES[label] ?? "bg-white/5 text-gray-500";
}

function formatDate(iso: string): string {
  // Append time to force local-time parsing; bare YYYY-MM-DD parses as UTC midnight.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function QuotesTable({
  estimates,
  page,
  hasMore,
}: Props): React.ReactElement {
  const showPagination = !(page === 1 && !hasMore);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
            <th className="pb-3">Quote #</th>
            <th className="pb-3">Date</th>
            <th className="pb-3">Status</th>
            <th className="pb-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((e) => {
            const label = partnerLabelForEstimateStatus(e.status);
            return (
              <tr key={e.estimate_id} className="border-b border-white/5">
                <td className="py-3 text-gray-200">{e.estimate_number}</td>
                <td className="py-3 text-gray-400">{formatDate(e.date)}</td>
                <td className="py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${pillClass(label)}`}
                  >
                    {label}
                  </span>
                </td>
                <td className="py-3 text-right text-gray-200">
                  {formatPrice(e.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-400">
          {page > 1 && (
            <Link
              href={`/portal/quotes?page=${page - 1}`}
              className="hover:text-bronze"
            >
              ← Previous
            </Link>
          )}
          <span className="text-gray-500">Page {page}</span>
          {hasMore && (
            <Link
              href={`/portal/quotes?page=${page + 1}`}
              className="hover:text-bronze"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
