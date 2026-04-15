import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { isPartner } from "@/lib/portal/types";
import { rateLimitQuotesList } from "@/lib/rate-limit";
import { getCachedEstimatesForContact } from "@/lib/zoho/books";
import { QuotesTable } from "./QuotesTable";

export const metadata = {
  title: "My Quotes | LOUISLUSO",
};

function parsePage(raw: string | undefined | string[]): number {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(val ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  // Portal layout already enforces auth + partner; this is defensive.
  if (!user) {
    return <ErrorShell message="Account setup incomplete, contact support." />;
  }

  const meta = isPartner(user.publicMetadata) ? user.publicMetadata : null;
  if (!meta?.zohoContactId) {
    return <ErrorShell message="Account setup incomplete, contact support." />;
  }

  const { success } = await rateLimitQuotesList(user.id);
  if (!success) {
    return <ErrorShell message="Too many requests. Please wait a moment and refresh." />;
  }

  const params = await searchParams;
  const page = parsePage(params.page);

  let data;
  try {
    data = await getCachedEstimatesForContact(meta.zohoContactId, {
      page,
      perPage: 20,
    });
  } catch (err) {
    console.error(
      `Failed to fetch quotes for ${meta.zohoContactId}:`,
      err,
    );
    return (
      <ErrorShell message="Unable to load quotes right now. Please try again in a moment." />
    );
  }

  // Past-end empty: user typed ?page=50 with only 5 quotes
  if (page > 1 && data.estimates.length === 0) {
    return (
      <PageShell>
        <p className="text-sm text-gray-400">No quotes on this page.</p>
        <Link
          href="/portal/quotes"
          className="mt-4 inline-block text-xs text-bronze hover:underline"
        >
          Back to page 1
        </Link>
      </PageShell>
    );
  }

  // First-time empty
  if (page === 1 && data.estimates.length === 0) {
    return (
      <PageShell>
        <p className="text-sm text-gray-400">
          You haven&apos;t submitted any quotes yet.
        </p>
        <Link
          href="/eyeglasses"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          Browse Collections
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <QuotesTable
        estimates={data.estimates}
        page={data.page}
        hasMore={data.hasMore}
      />
    </PageShell>
  );
}

function PageShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">My Quotes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review your submitted quotes and orders
        </p>
        <div className="mt-10">{children}</div>
      </div>
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
