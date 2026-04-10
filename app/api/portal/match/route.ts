import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getContactByEmail } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ matched: false });
  }

  const contact = await getContactByEmail(email);
  if (!contact) {
    return NextResponse.json({ matched: false });
  }

  const metadata: Record<string, string> = {
    role: "partner",
    zohoContactId: contact.id,
    company: contact.Account_Name,
  };

  const client = await clerkClient();
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: metadata,
  });

  return NextResponse.json({ matched: true, company: contact.Account_Name });
}
