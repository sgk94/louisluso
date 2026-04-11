import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isPartner } from "@/lib/portal/types";
import { getContactByEmail } from "@/lib/zoho/crm";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Already a partner — proceed
  if (isPartner(user.publicMetadata)) {
    return <>{children}</>;
  }

  // Not yet matched — try auto-matching by email
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) {
    try {
      const contact = await getContactByEmail(email);
      if (contact) {
        const metadata: Record<string, string> = {
          role: "partner",
          zohoContactId: contact.id,
          company: contact.Account_Name,
        };
        const pricingPlanId = (contact as Record<string, unknown>).Pricing_Plan_Id;
        if (typeof pricingPlanId === "string" && pricingPlanId) {
          metadata.pricingPlanId = pricingPlanId;
        }

        const client = await clerkClient();
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: metadata,
        });
        redirect("/portal");
      }
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error;
      console.error("CRM auto-match failed:", error);
    }
  }

  // No match — redirect to pending page (outside portal layout)
  redirect("/pending-approval");
}
