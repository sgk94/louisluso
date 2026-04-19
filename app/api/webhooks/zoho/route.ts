import { NextResponse } from "next/server";

// Stub for 5e. Logs every payload so we can see what Zoho actually sends.
// Real handlers (revalidateTag(orderLifecycleTag(...)) on accept/invoice/ship/pay)
// land in a future phase.
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = "<<unparseable>>";
  }
  console.info(JSON.stringify({ tag: "zoho_webhook_stub", body }));
  return NextResponse.json({ ok: true }, { status: 200 });
}
