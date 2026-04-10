import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — LOUISLUSO" };

export default function TermsPage(): React.ReactElement {
  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Terms of Service</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <p>These terms of service govern your use of the LOUISLUSO website and services provided by Q-Vision Optics, Inc.</p>
          <p><em className="text-gray-400">Full terms of service content will be provided by the company. This is placeholder text.</em></p>
          <p>For questions, contact us at <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">cs@louisluso.com</a>.</p>
        </div>
      </div>
    </main>
  );
}
