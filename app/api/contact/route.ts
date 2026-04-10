import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { contactSchema } from "@/lib/schemas/contact";
import { sendEmail } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    await sendEmail({
      to: "cs@louisluso.com",
      subject: `[Contact Form] ${subject} — ${name}`,
      replyTo: email,
      body: [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : "",
        `Subject: ${subject}`,
        "",
        "Message:",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
