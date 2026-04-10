import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { contactDealerSchema } from "@/lib/schemas/contact-dealer";
import { sendEmail } from "@/lib/gmail";
import { rateLimitDealerContact } from "@/lib/rate-limit";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimitDealerContact(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  const dealer = MOCK_DEALERS.find((d) => d.id === id);
  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = contactDealerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { customerName, customerEmail, message, productSlug } = parsed.data;

  const emailLines = [
    `A customer found your store on louisluso.com and would like to connect.`,
    "",
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
  ];

  if (message) {
    emailLines.push("", "Message:", message);
  }

  if (productSlug) {
    emailLines.push(
      "",
      `Product of interest: ${productSlug}`,
      `View product: https://louisluso.com/products/${productSlug}`,
    );
  }

  emailLines.push(
    "",
    "---",
    "This message was sent via the LOUISLUSO Dealer Locator.",
    "Reply directly to this email to respond to the customer.",
  );

  try {
    await sendEmail({
      to: dealer.email,
      subject: `Customer Inquiry via LOUISLUSO — ${customerName}`,
      replyTo: customerEmail,
      bcc: ["admin@louisluso.com"],
      body: emailLines.join("\n"),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
