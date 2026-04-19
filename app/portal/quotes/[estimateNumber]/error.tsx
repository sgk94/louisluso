"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error("OrderDetailPage error boundary", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h2 className="font-heading text-2xl text-white">Something went wrong.</h2>
        <p className="mt-4 text-sm text-gray-400">
          Our system hit an unexpected error loading this quote.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-bronze px-5 py-2 text-xs uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white"
          >
            Try again
          </button>
          <Link
            href="/portal/quotes"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            My Quotes
          </Link>
          <a
            href="mailto:cs@louisluso.com"
            className="border border-white/15 px-5 py-2 text-xs uppercase tracking-[2px] text-gray-300 hover:border-white/30"
          >
            Contact Support
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-[11px] text-gray-600">
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
