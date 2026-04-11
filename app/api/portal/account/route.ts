import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { getContactById } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";

export async function GET(request: Request): Promise<NextResponse> {
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

  if (!isPartner(user.publicMetadata)) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  const { zohoContactId, pricingPlanId } = user.publicMetadata;

  try {
    const contact = await getContactById(zohoContactId);
    return NextResponse.json({
      company: contact.Account_Name,
      firstName: contact.First_Name,
      lastName: contact.Last_Name,
      email: contact.Email,
      phone: contact.Phone,
      address: {
        street: contact.Mailing_Street,
        city: contact.Mailing_City,
        state: contact.Mailing_State,
        zip: contact.Mailing_Zip,
      },
      pricingTier: pricingPlanId ? "Custom" : "Standard",
    });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}
