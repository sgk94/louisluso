import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { createEstimate, ESTIMATES_LIST_CACHE_TAG } from "@/lib/zoho/books";
import { getItems } from "@/lib/zoho/inventory";
import { sendEmail } from "@/lib/gmail";
import { rateLimitQuote } from "@/lib/rate-limit";
import { isPartner } from "@/lib/portal/types";
import { quoteSchema } from "@/lib/schemas/quote";
import { formatPrice } from "@/lib/catalog/format";
import { COMPANY } from "@/lib/constants";

export async function POST(request: Request): Promise<NextResponse> {
  // Fix 1: parse JSON in its own try-catch so malformed body → 400, not 500
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fix 5: auth before rate limit so we can key by user.id
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isPartner(user.publicMetadata)) {
    return NextResponse.json({ error: "Not a partner" }, { status: 403 });
  }

  // Fix 5: dedicated per-user rate limiter
  const { success: rateLimitOk } = await rateLimitQuote(user.id);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { zohoContactId, company } = user.publicMetadata;
  // TODO Phase 5d: look up bespoke pricing from partner's price book if pricingPlanId is set
  const { items, notes } = parsed.data;

  try {
    // Fix 3: fetch server-side prices from Zoho — never trust client-submitted prices
    const zohoItems = await getItems();
    const priceMap = new Map<string, number>(
      zohoItems.map((item) => [item.item_id, item.rate]),
    );

    for (const item of items) {
      if (!priceMap.has(item.itemId)) {
        return NextResponse.json(
          { error: `Item not found: ${item.itemId}` },
          { status: 400 },
        );
      }
    }

    const lineItems = items.map((item) => ({
      item_id: item.itemId,
      quantity: item.quantity,
      rate: priceMap.get(item.itemId) as number, // validated above
    }));

    const estimate = await createEstimate(zohoContactId, lineItems, notes);

    // Invalidate the cached quotes list so the new estimate appears immediately.
    // Wrapped in try/catch — a revalidation failure must not roll back a
    // successful estimate submission.
    try {
      revalidateTag(ESTIMATES_LIST_CACHE_TAG, "max");
    } catch (revalErr) {
      console.error("Quote cache revalidation failed:", revalErr);
    }

    // Fix 2: email is best-effort — failure must not roll back the estimate
    try {
      const partnerEmail = user.emailAddresses[0]?.emailAddress;
      if (partnerEmail) {
        const total = lineItems.reduce(
          (sum, li) => sum + li.quantity * li.rate,
          0,
        );
        const itemCount = lineItems.reduce((sum, li) => sum + li.quantity, 0);

        await sendEmail({
          to: partnerEmail,
          subject: `LOUISLUSO Quote Received — ${estimate.estimate_number}`,
          // Fix 6: use COMPANY.email constant instead of hardcoded string
          bcc: [COMPANY.email],
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
    } catch (emailErr) {
      // Fix 2: log but do not surface — estimate was already created
      console.error("Quote confirmation email failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      estimateNumber: estimate.estimate_number,
    });
  } catch (err) {
    // Fix 6: log the error for observability
    console.error("Quote submission failed:", err);
    return NextResponse.json({ error: "Failed to submit quote" }, { status: 500 });
  }
}
