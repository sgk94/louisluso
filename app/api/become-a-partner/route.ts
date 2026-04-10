import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { partnerSchema } from "@/lib/schemas/partner";
import { createLead, attachFileToLead } from "@/lib/zoho/crm";
import type { CRMLeadInput } from "@/lib/zoho/crm";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success: rateLimitOk } = await rateLimit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const formData = await request.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }

  const parsed = partnerSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const file = formData.get("creditApplication") as File | null;
  let fileBuffer: Uint8Array | null = null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 20MB" }, { status: 400 });
    }
    fileBuffer = new Uint8Array(await file.arrayBuffer());
    // Validate PDF magic bytes: %PDF- (hex 25 50 44 46 2D)
    const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2D];
    const isPdf = PDF_MAGIC.every((byte, i) => fileBuffer![i] === byte);
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }
  }

  try {
    const nameParts = data.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const referral =
      data.referralSource === "Other"
        ? `Other: ${data.referralOther}`
        : data.referralSource;

    const leadInput: CRMLeadInput = {
      Company: data.company,
      First_Name: firstName,
      Last_Name: lastName,
      Email: data.email,
      Phone: data.phone,
      Street: data.address,
      City: data.city,
      State: data.state,
      Zip_Code: data.zip,
      Lead_Source: referral,
      Description: `Partner application via website. Referral: ${referral}`,
    };

    const leadId = await createLead(leadInput);

    if (fileBuffer) {
      await attachFileToLead(leadId, fileBuffer, file!.name);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
