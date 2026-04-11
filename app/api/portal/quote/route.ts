import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { createEstimate } from "@/lib/zoho/books";
import { sendEmail } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";
import { quoteSchema } from "@/lib/schemas/quote";
import { formatPrice } from "@/lib/catalog/format";

export async function POST(request: Request): Promise<NextResponse> {
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

  const body = await request.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { zohoContactId, company } = user.publicMetadata;
  const { items, notes } = parsed.data;

  const lineItems = items.map((item) => ({
    item_id: item.itemId,
    quantity: item.quantity,
    rate: item.price,
  }));

  try {
    const estimate = await createEstimate(zohoContactId, lineItems, notes);
    const partnerEmail = user.emailAddresses[0]?.emailAddress;

    if (partnerEmail) {
      const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
      const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

      await sendEmail({
        to: partnerEmail,
        subject: `LOUISLUSO Quote Received — ${estimate.estimate_number}`,
        bcc: ["admin@louisluso.com"],
        body: [
          `Hi,`,
          "",
          `We've received your quote (${estimate.estimate_number}).`,
          "",
          `Company: ${company}`,
          `Items: ${itemCount} pieces`,
          `Subtotal: ${formatPrice(total)}`,
          "",
          "We'll review availability and confirm shortly.",
          "",
          "— The LOUISLUSO Team",
          "https://louisluso.com",
        ].join("\n"),
      });
    }

    return NextResponse.json({
      success: true,
      estimateNumber: estimate.estimate_number,
    });
  } catch {
    return NextResponse.json({ error: "Failed to submit quote" }, { status: 500 });
  }
}
