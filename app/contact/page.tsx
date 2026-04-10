"use client";

import { useState } from "react";
import { TextInput } from "@/app/components/forms/TextInput";
import { TextArea } from "@/app/components/forms/TextArea";
import { Select } from "@/app/components/forms/Select";
import { SubmitButton } from "@/app/components/forms/SubmitButton";

const SUBJECT_OPTIONS = [
  { value: "General Inquiry", label: "General Inquiry" },
  { value: "Product Question", label: "Product Question" },
  { value: "Partnership", label: "Partnership" },
  { value: "Other", label: "Other" },
];

export default function ContactPage(): React.ReactElement {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          setGeneralError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setGeneralError("Unable to send message. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl">Thank You</h1>
          <p className="mt-4 text-gray-600">We&apos;ve received your message and will get back to you shortly.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-4xl">Contact Us</h1>
        <p className="mt-2 text-gray-600">Have a question? We&apos;d love to hear from you.</p>

        <div className="mt-12 grid grid-cols-1 gap-16 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {generalError && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {generalError}
              </div>
            )}
            <TextInput label="Name" name="name" required value={form.name} onChange={(v) => update("name", v)} error={errors.name} />
            <TextInput label="Email" name="email" type="email" required value={form.email} onChange={(v) => update("email", v)} error={errors.email} />
            <TextInput label="Phone" name="phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} />
            <Select label="Subject" name="subject" required options={SUBJECT_OPTIONS} value={form.subject} onChange={(v) => update("subject", v)} error={errors.subject} />
            <TextArea label="Message" name="message" required value={form.message} onChange={(v) => update("message", v)} error={errors.message} />
            <SubmitButton label="Send Message" loading={loading} />
          </form>

          <div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1px] text-gray-500">Address</h3>
                <p className="mt-1 text-sm text-gray-700">Q-Vision Optics, Inc.<br />3413 N. Kennicott Ave, Ste B<br />Arlington Heights, IL</p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[1px] text-gray-500">Email</h3>
                <a href="mailto:cs@louisluso.com" className="mt-1 block text-sm text-bronze hover:underline">cs@louisluso.com</a>
              </div>
            </div>

            <div className="mt-8 aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <iframe
                title="LOUISLUSO Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2960.0!2d-87.98!3d42.08!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDLCsDA0JzQ4LjAiTiA4N8KwNTgnNDguMCJX!5e0!3m2!1sen!2sus!4v1"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
