import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { quoteFallbackSchema } from "@/lib/schemas/quote-fallback";

export async function POST(request: Request): Promise<NextResponse> {
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
