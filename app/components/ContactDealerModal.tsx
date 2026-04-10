"use client";

import { useState, useEffect, useCallback } from "react";
import type { Dealer } from "@/lib/dealers/types";

interface ContactDealerModalProps {
  dealer: Dealer;
  onClose: () => void;
  productSlug: string | null;
}

export function ContactDealerModal({ dealer, onClose, productSlug }: ContactDealerModalProps): React.ReactElement {
  const [form, setForm] = useState({ customerName: "", customerEmail: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  function update(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGeneralError("");

    try {
      const response = await fetch(`/api/dealers/${dealer.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productSlug: productSlug ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            fieldErrors[key] = (msgs as string[])[0] ?? "";
          }
          setErrors(fieldErrors);
        } else {
          setGeneralError(data.error ?? "Something went wrong.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setGeneralError("Unable to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-white">Contact {dealer.name}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {dealer.address.city}, {dealer.address.state} &middot; {dealer.phone}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="text-lg text-gray-500 hover:text-gray-300">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {submitted ? (
            <div className="py-8 text-center">
              <p className="text-sm text-white">We&apos;ve sent your info to {dealer.name}.</p>
              <p className="mt-2 text-xs text-gray-500">They&apos;ll reply directly to your email.</p>
              <button
                onClick={handleClose}
                className="mt-6 rounded bg-bronze px-6 py-2 text-xs font-semibold text-white hover:bg-bronze-light"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {generalError && (
                <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {generalError}
                </div>
              )}

              {/* Name */}
              <div className="mb-3.5">
                <label htmlFor="customerName" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={form.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.customerName && <p className="mt-1 text-[11px] text-red-400">{errors.customerName}</p>}
              </div>

              {/* Email */}
              <div className="mb-3.5">
                <label htmlFor="customerEmail" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Your Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => update("customerEmail", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.customerEmail && <p className="mt-1 text-[11px] text-red-400">{errors.customerEmail}</p>}
              </div>

              {/* Message */}
              <div className="mb-4">
                <label htmlFor="dealerMessage" className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">
                  Message
                </label>
                <textarea
                  id="dealerMessage"
                  rows={3}
                  placeholder="I'm interested in trying on..."
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-bronze"
                />
                {errors.message && <p className="mt-1 text-[11px] text-red-400">{errors.message}</p>}
              </div>

              {/* Product context */}
              {productSlug && (
                <div className="mb-4 flex items-center gap-3 rounded-md border border-bronze/20 bg-bronze/[0.06] px-3 py-2.5">
                  <div className="flex h-7 w-10 shrink-0 items-center justify-center rounded bg-bronze/20 text-[8px] text-bronze">
                    IMG
                  </div>
                  <div>
                    <p className="text-[11px] text-bronze">Asking about:</p>
                    <p className="text-xs text-gray-300">{productSlug}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-bronze py-2.5 text-[13px] font-semibold tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
              <p className="mt-2.5 text-center text-[10px] text-gray-600">
                Your info will be sent to the dealer. They&apos;ll reply directly to your email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
