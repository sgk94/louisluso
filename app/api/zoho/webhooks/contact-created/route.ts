import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { rateLimitZohoWebhook } from "@/lib/rate-limit";
import { getContactById } from "@/lib/zoho/crm";
import { sendPartnerInvite } from "@/lib/portal/invite";

const payloadSchema = z.object({
  contactId: z.string().min(1),
});

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";

  const { success: rateLimitOk } = await rateLimitZohoWebhook(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const provided = headerList.get("x-zoho-webhook-token") ?? "";
  if (!secretsMatch(provided, env.ZOHO_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { contactId } = parsed.data;

  let contact;
  try {
    contact = await getContactById(contactId);
  } catch (err) {
    console.error(
      `Zoho webhook: getContactById(${contactId}) failed:`,
      err,
    );
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (!contact.Email) {
    console.error(`Zoho webhook: contact ${contactId} has no Email`);
    return NextResponse.json(
      { error: "Contact missing email" },
      { status: 422 },
    );
  }

  try {
    await sendPartnerInvite(contact);
  } catch (err) {
    console.error(
      `Zoho webhook: sendPartnerInvite failed for ${contact.Email}:`,
      err,
    );
    return NextResponse.json(
      { error: "Invite delivery failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
