"use client";

import { useState, useEffect } from "react";

interface AccountInfo {
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  pricingTier: string;
}

export default function AccountPage(): React.ReactElement {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchAccount(): Promise<void> {
      try {
        const res = await fetch("/api/portal/account");
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setAccount(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">Loading account...</p>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-400">Unable to load account info.</p>
      </main>
    );
  }

  const fields = [
    { label: "Company", value: account.company },
    { label: "Contact", value: `${account.firstName} ${account.lastName}` },
    { label: "Email", value: account.email },
    { label: "Phone", value: account.phone },
    {
      label: "Address",
      value: [
        account.address.street,
        `${account.address.city}, ${account.address.state} ${account.address.zip}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    { label: "Pricing Tier", value: account.pricingTier },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl text-white">Account</h1>
        <p className="mt-1 text-sm text-gray-500">Your partner account details</p>

        <div className="mt-10 space-y-6">
          {fields.map((field) => (
            <div key={field.label} className="border-b border-white/10 pb-4">
              <dt className="text-[11px] font-medium uppercase tracking-[2px] text-gray-500">
                {field.label}
              </dt>
              <dd className="mt-1.5 whitespace-pre-line text-sm text-gray-200">
                {field.value || "—"}
              </dd>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-600">
          Need to update your information? Contact{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>
        </p>
      </div>
    </main>
  );
}
