"use client";
import { useState } from "react";
import { SubmittedConfirmation } from "./SubmittedConfirmation";

export default function QuoteFallbackPage(): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/quote-fallback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please email cs@louisluso.com directly.");
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      {submitted ? (
        <SubmittedConfirmation />
      ) : (
        <div className="mx-auto max-w-xl">
          <h1 className="font-heading text-3xl text-white">Quote without logging in</h1>
          <p className="mt-2 text-sm text-gray-500">
            Send Ken a list of what you want — he&apos;ll reply within 24 hours.
          </p>
          <form className="mt-10 space-y-5" onSubmit={onSubmit}>
            <Field label="Email" name="email" type="email" required />
            <Field label="Name" name="name" required />
            <Field label="Company" name="company" required />
            <Field label="Phone (optional)" name="phone" type="tel" />
            <Textarea label="Products" name="products" rows={4} required placeholder="e.g., SP1018 in C2 × 5, T-7241 in C8 × 10" />
            <Textarea label="Notes (optional)" name="notes" rows={3} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-bronze px-6 py-3 text-xs font-medium uppercase tracking-[2px] text-bronze hover:bg-bronze hover:text-white disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit Quote Request"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-500">
            Or email{" "}
            <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
              cs@louisluso.com
            </a>{" "}
            directly.
          </p>
        </div>
      )}
    </main>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[2px] text-gray-400">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full border border-white/10 bg-[#111] px-4 py-2 text-sm text-white focus:border-bronze focus:outline-none"
      />
    </label>
  );
}

function Textarea({ label, name, rows, required, placeholder }: { label: string; name: string; rows: number; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[2px] text-gray-400">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full border border-white/10 bg-[#111] px-4 py-2 text-sm text-white focus:border-bronze focus:outline-none"
      />
    </label>
  );
}
