import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { isPartner } from "@/lib/portal/types";
import { rateLimitOrderDetail } from "@/lib/rate-limit";
import { getCachedOrderLifecycle } from "@/lib/zoho/books";
import { getProfile } from "@/lib/portal/workflow";
import { OrderDetail } from "./OrderDetail";

export const metadata = {
  title: "Order | LOUISLUSO",
};

function makeErrorId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<React.ReactElement> {
  const errorId = makeErrorId();
  const user = await currentUser();
  if (!user) {
    return <ErrorShell message="Account setup incomplete, contact support." errorId={errorId} />;
  }

  const meta = isPartner(user.publicMetadata) ? user.publicMetadata : null;
  if (!meta?.zohoContactId) {
    return <ErrorShell message="Account setup incomplete, contact support." errorId={errorId} />;
  }

  const { success } = await rateLimitOrderDetail(user.id);
  if (!success) {
    return (
      <ErrorShell
        message="Too many requests. Please wait a moment and refresh. Limits reset every 5 minutes."
        errorId={errorId}
      />
    );
  }

  const { estimateNumber } = await params;

  let lifecycle;
  try {
    lifecycle = await getCachedOrderLifecycle(meta.zohoContactId, estimateNumber);
  } catch (err) {
    console.error(`getCachedOrderLifecycle failed [errorId=${errorId}]`, err);
    return (
      <ErrorShell
        message="Unable to load quote right now. Please try again in a moment."
        errorId={errorId}
      />
    );
  }

  if (!lifecycle) {
    return <NotFoundShell errorId={errorId} />;
  }

  const profile = getProfile(meta.workflowProfile);

  return (
    <OrderDetail
      estimate={lifecycle.estimate}
      salesOrder={lifecycle.salesOrder}
      invoice={lifecycle.invoice}
      shipment={lifecycle.shipment}
      profile={profile}
      errorId={errorId}
    />
  );
}

function ErrorShell({ message, errorId }: { message: string; errorId: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <p className="text-sm text-gray-400">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/portal/quotes"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            My Quotes
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
          <Link
            href="/quote-fallback"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Quote Without Login
          </Link>
        </div>
        <p className="mt-6 text-[11px] text-gray-600">Reference: <code>{errorId}</code></p>
      </div>
    </main>
  );
}

function NotFoundShell({ errorId }: { errorId: string }): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h2 className="font-heading text-2xl text-white">We couldn&apos;t find that quote.</h2>
        <p className="mt-4 text-sm text-gray-400">It may still be processing.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/portal/quotes"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            View My Quotes
          </Link>
          <Link
            href="/eyeglasses"
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
        </div>
        <p className="mt-6 text-[11px] text-gray-600">Reference: <code>{errorId}</code></p>
      </div>
    </main>
  );
}
