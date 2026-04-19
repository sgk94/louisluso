import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/gmail";
import { quoteFallbackSchema } from "@/lib/schemas/quote-fallback";
import { rateLimitQuoteFallback } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimitQuoteFallback(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = quoteFallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, name, company, phone, products, notes } = parsed.data;
  const subject = `Quote request from ${company}`;
  const text = [
    `New no-login quote request via /quote-fallback:`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    phone ? `Phone: ${phone}` : null,
    "",
    `Products requested:`,
    products,
    "",
    notes ? `Notes:` : null,
    notes ?? null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    await sendEmail({
      to: "cs@louisluso.com",
      subject,
      body: text,
    });
  } catch (err) {
    console.error("quote-fallback email failed", err);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
