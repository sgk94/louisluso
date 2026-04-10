import { google } from "googleapis";
import { env } from "@/lib/env";

function getGmailClient(): ReturnType<typeof google.gmail> {
  const auth = new google.auth.OAuth2(
    env.GMAIL_CLIENT_ID,
    env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: "v1", auth });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  bcc?: string[];
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const gmail = getGmailClient();

  const headers = [
    `To: ${options.to}`,
    `From: cs@louisluso.com`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`);
  }

  if (options.bcc && options.bcc.length > 0) {
    headers.push(`Bcc: ${options.bcc.join(", ")}`);
  }

  const message = [...headers, "", options.body].join("\r\n");
  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });
}
