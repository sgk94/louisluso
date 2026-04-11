import { currentUser } from "@clerk/nextjs/server";
import { getContactById } from "@/lib/zoho/crm";
import { isPartner } from "@/lib/portal/types";

export const metadata = {
  title: "Account | LOUISLUSO",
};

export default async function AccountPage(): Promise<React.ReactElement> {
  const user = await currentUser();
  const meta = isPartner(user?.publicMetadata) ? user!.publicMetadata : null;

  if (!meta) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-400">Unable to load account info.</p>
      </main>
    );
  }

  let contact;
  try {
    contact = await getContactById(meta.zohoContactId);
  } catch {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-400">Unable to load account info.</p>
      </main>
    );
  }

  const fields = [
    { label: "Company", value: contact.Account_Name },
    { label: "Contact", value: `${contact.First_Name} ${contact.Last_Name}` },
    { label: "Email", value: contact.Email },
    { label: "Phone", value: contact.Phone },
    {
      label: "Address",
      value: [
        contact.Mailing_Street,
        `${contact.Mailing_City}, ${contact.Mailing_State} ${contact.Mailing_Zip}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    { label: "Pricing Tier", value: meta.pricingPlanId ? "Custom" : "Standard" },
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
