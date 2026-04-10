import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — LOUISLUSO" };

export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Privacy Policy</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <p>This privacy policy describes how LOUISLUSO / Q-Vision Optics, Inc. collects, uses, and protects your personal information when you visit our website or interact with our services.</p>
          <p><em className="text-gray-400">Full privacy policy content will be provided by the company. This is placeholder text.</em></p>
          <p>For questions about our privacy practices, contact us at <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">cs@louisluso.com</a>.</p>
        </div>
      </div>
    </main>
  );
}
