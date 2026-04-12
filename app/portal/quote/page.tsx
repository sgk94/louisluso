"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/components/CartProvider";
import { formatPrice } from "@/lib/catalog/format";

export default function QuotePage(): React.ReactElement {
  const { items, subtotal, totalQuantity, update, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/portal/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit quote");
        return;
      }

      setSubmitted(data.estimateNumber);
      clear();
    } catch {
      setError("Unable to submit quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-3xl text-white">Quote Submitted</h1>
          <p className="mt-4 text-sm text-gray-400">
            Your quote ({submitted}) has been received. We&apos;ll review
            availability and confirm shortly.
          </p>
          <Link
            href="/eyeglasses"
            className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-3xl text-white">Your Quote</h1>
          <p className="mt-4 text-sm text-gray-400">
            Your quote is empty. Browse our collections to get started.
          </p>
          <Link
            href="/eyeglasses"
            className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
          >
            Browse Catalog
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">Your Quote</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalQuantity} item{totalQuantity !== 1 ? "s" : ""} &middot;{" "}
          {formatPrice(subtotal)}
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[2px] text-gray-500">
                <th className="pb-3">Product</th>
                <th className="pb-3">Color</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.itemId} className="border-b border-white/5">
                  <td className="py-3 text-gray-200">{item.productName}</td>
                  <td className="py-3 text-gray-400">{item.colorName}</td>
                  <td className="py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        if (qty <= 0) remove(item.itemId);
                        else update(item.itemId, qty);
                      }}
                      className="w-16 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-gray-200 outline-none focus:border-bronze"
                    />
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {formatPrice(item.price)}
                  </td>
                  <td className="py-3 text-right text-gray-200">
                    {formatPrice(item.quantity * item.price)}
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <button
                      onClick={() => remove(item.itemId)}
                      className="text-gray-600 transition-colors hover:text-red-400"
                      aria-label={`Remove ${item.productName} ${item.colorName}`}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex gap-4">
            <Link href="/eyeglasses" className="text-xs text-bronze hover:underline">
              Continue Shopping
            </Link>
            <button onClick={clear} className="text-xs text-gray-500 hover:text-red-400">
              Clear All
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-400">Subtotal</p>
            <p className="text-xl font-semibold text-white">{formatPrice(subtotal)}</p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 rounded bg-bronze px-8 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Quote"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
