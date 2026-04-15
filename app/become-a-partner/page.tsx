"use client";

import { useState } from "react";
import { TextInput } from "@/app/components/forms/TextInput";
import { Select } from "@/app/components/forms/Select";
import { FileUpload } from "@/app/components/forms/FileUpload";
import { SubmitButton } from "@/app/components/forms/SubmitButton";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
].map((s) => ({ value: s, label: s }));

const REFERRAL_OPTIONS = [
  { value: "Friend", label: "Friend" },
  { value: "Advertisement", label: "Advertisement" },
  { value: "Social Media", label: "Social Media" },
  { value: "Other", label: "Other" },
];

export default function BecomeAPartnerPage(): React.ReactElement {
  const [form, setForm] = useState({
    company: "", contactName: "", email: "", phone: "",
    address: "", city: "", state: "", zip: "",
    referralSource: "", referralOther: "",
  });
  const [file, setFile] = useState<File | null>(null);
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
      const formData = new FormData();
      for (const [key, value] of Object.entries(form)) formData.append(key, value);
      if (file) formData.append("creditApplication", file);

      const response = await fetch("/api/become-a-partner", { method: "POST", body: formData });
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
      setGeneralError("Unable to submit application. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl">Thank You</h1>
          <p className="mt-4 text-gray-600">We&apos;ve received your application and will review it within 2-3 business days.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl">Partner With LOUISLUSO</h1>
        <p className="mt-2 text-gray-600">Join 500+ optical stores carrying the world&apos;s lightest frames. Competitive wholesale pricing, dedicated support, and a product your customers will love.</p>

        <form onSubmit={handleSubmit} className="mt-12 space-y-6">
          {generalError && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {generalError}
            </div>
          )}
          <TextInput label="Company Name" name="company" required value={form.company} onChange={(v) => update("company", v)} error={errors.company} />
          <TextInput label="Contact Name" name="contactName" required value={form.contactName} onChange={(v) => update("contactName", v)} error={errors.contactName} />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextInput label="Email" name="email" type="email" required value={form.email} onChange={(v) => update("email", v)} error={errors.email} />
            <TextInput label="Phone" name="phone" type="tel" required value={form.phone} onChange={(v) => update("phone", v)} error={errors.phone} />
          </div>
          <TextInput label="Street Address" name="address" required value={form.address} onChange={(v) => update("address", v)} error={errors.address} />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <TextInput label="City" name="city" required value={form.city} onChange={(v) => update("city", v)} error={errors.city} />
            </div>
            <Select label="State" name="state" required options={US_STATES} value={form.state} onChange={(v) => update("state", v)} error={errors.state} />
            <TextInput label="Zip Code" name="zip" required value={form.zip} onChange={(v) => update("zip", v)} error={errors.zip} />
          </div>
          <Select label="How did you hear about us?" name="referralSource" required options={REFERRAL_OPTIONS} value={form.referralSource} onChange={(v) => update("referralSource", v)} error={errors.referralSource} />
          {form.referralSource === "Other" && (
            <TextInput label="Please specify" name="referralOther" required value={form.referralOther} onChange={(v) => update("referralOther", v)} error={errors.referralOther} />
          )}
          <FileUpload label="Credit Application (optional)" name="creditApplication" accept=".pdf" maxSizeMB={20} onFileSelect={setFile} error={errors.creditApplication} />
          <SubmitButton label="Submit Application" loading={loading} />
        </form>
      </div>
    </main>
  );
}
