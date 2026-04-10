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
        const client = await clerkClient();
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: {
            role: "partner",
            zohoContactId: contact.id,
            company: contact.Account_Name,
          },
        });
        // Redirect to refresh metadata
        redirect("/portal");
      }
    } catch {
      // CRM lookup failed — fall through to pending
    }
  }

  // No match — redirect to pending page (outside portal layout)
  redirect("/pending-approval");
}
