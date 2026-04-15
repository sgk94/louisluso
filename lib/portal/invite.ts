import { sendEmail } from "@/lib/gmail";
import { env } from "@/lib/env";
import type { CRMContact } from "@/lib/zoho/crm";

interface SendPartnerInviteResult {
  subject: string;
  body: string;
  dryRun: boolean;
}

export async function sendPartnerInvite(
  contact: Pick<CRMContact, "Email" | "First_Name" | "Last_Name" | "Account_Name">,
  options: { dryRun?: boolean } = {},
): Promise<SendPartnerInviteResult> {
  const firstName = contact.First_Name || "Partner";
  const signupUrl = env.PORTAL_SIGNUP_URL;

  const subject = "Welcome to the LOUISLUSO Partner Portal";
  const body = [
    `Hi ${firstName},`,
    "",
    "Great news — your LOUISLUSO partner application has been approved!",
    "",
    "You can now access wholesale pricing and place orders through our Partner Portal.",
    "",
    `To get started, create your account using this email address (${contact.Email}):`,
    "",
    signupUrl,
    "",
    "Once you've created your account, you'll have access to:",
    "  - Wholesale pricing on all collections",
    "  - Online ordering",
    "  - Order history and tracking",
    "",
    "If you have any questions, reply to this email or contact us at cs@louisluso.com.",
    "",
    "Welcome aboard!",
    "",
    "— The LOUISLUSO Team",
    "https://louisluso.com",
  ].join("\n");

  if (options.dryRun) {
    return { subject, body, dryRun: true };
  }

  await sendEmail({ to: contact.Email, subject, body });
  return { subject, body, dryRun: false };
}
