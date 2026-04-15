import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { isPartner } from "@/lib/portal/types";

export const metadata = {
  title: "Partner Dashboard | LOUISLUSO",
};

export default async function PortalDashboard(): Promise<React.ReactElement> {
  const user = await currentUser();
  const meta = isPartner(user?.publicMetadata) ? user!.publicMetadata : null;
  const firstName = user?.firstName ?? "Partner";

  const cards = [
    {
      title: "Browse Catalog",
      description: "View our collections with your pricing",
      href: "/eyeglasses",
      enabled: true,
    },
    {
      title: "My Quotes",
      description: "Review submitted quotes and their status",
      href: "/portal/quotes",
      enabled: true,
    },
    {
      title: "Account Settings",
      description: "View your account details",
      href: "/portal/account",
      enabled: true,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl text-white">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-bronze">{meta?.company}</p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.enabled ? card.href : "#"}
              className={`rounded-lg border px-6 py-5 transition-colors ${
                card.enabled
                  ? "border-white/10 bg-white/[0.02] hover:border-bronze/30 hover:bg-white/[0.04]"
                  : "pointer-events-none border-white/5 bg-white/[0.01] opacity-50"
              }`}
            >
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
