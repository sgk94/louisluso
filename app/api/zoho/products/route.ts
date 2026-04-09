import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getItemGroups } from "@/lib/zoho/inventory";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 900; // ISR: 15 minutes

export async function GET(): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success } = await rateLimit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  try {
    const groups = await getItemGroups();
    const products = groups.map((g) => ({
      id: g.group_id,
      name: g.group_name,
      description: g.description,
      brand: g.brand,
      category: g.category_name,
      image: g.image_name,
      variants: g.items.map((item) => ({
        id: item.item_id,
        name: item.name,
        sku: item.sku,
        price: item.rate,
        inStock: item.stock_on_hand > 0,
        image: item.image_name,
      })),
    }));
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 502 },
    );
  }
}
