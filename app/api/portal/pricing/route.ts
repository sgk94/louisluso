import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { getPriceBook } from "@/lib/zoho/inventory";
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

  const { pricingPlanId } = user.publicMetadata;

  if (!pricingPlanId) {
    return NextResponse.json({ type: "listing" });
  }

  const url = new URL(request.url);
  const itemsParam = url.searchParams.get("items") ?? "";
  const requestedIds = new Set(itemsParam.split(",").filter(Boolean));

  const priceBook = await getPriceBook(pricingPlanId);
  const prices: Record<string, number> = {};

  for (const item of priceBook.pricebook_items ?? []) {
    if (requestedIds.has(item.item_id)) {
      prices[item.item_id] = item.pricebook_rate;
    }
  }

  return NextResponse.json({ type: "bespoke", prices });
}
