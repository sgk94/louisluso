import { google, type gmail_v1, type sheets_v4 } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createTransport } from "nodemailer";
import { env } from "./env.ts";

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = join(__dir, "credentials.json");
const TOKEN_PATH = join(__dir, "token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

interface Credentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

let cachedClient: gmail_v1.Gmail | null = null;
let cachedSheetsClient: sheets_v4.Sheets | null = null;

function loadCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing ${CREDENTIALS_PATH}. Download OAuth2 credentials from Google Cloud Console.`
    );
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8")) as Credentials;
}

function loadToken(): TokenData {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error(
      `Missing ${TOKEN_PATH}. Run "pnpm email:auth" to complete OAuth2 setup.`
    );
  }
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8")) as TokenData;
}

function createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  const creds = loadCredentials();
  const { client_id, client_secret, redirect_uris } = creds.installed;

  const oauth2 = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0] ?? "http://localhost:3000/oauth2callback"
  );

  const token = loadToken();
  oauth2.setCredentials(token);

  // Persist refreshed tokens automatically
  oauth2.on("tokens", (newTokens) => {
    const existing = loadToken();
    const merged = { ...existing, ...newTokens };
    writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2) + "\n");
  });

  return oauth2;
}

export function getGmailClient(): gmail_v1.Gmail {
  if (!cachedClient) {
    const auth = createOAuth2Client();
    cachedClient = google.gmail({ version: "v1", auth });
  }
  return cachedClient;
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (!cachedSheetsClient) {
    const auth = createOAuth2Client();
    cachedSheetsClient = google.sheets({ version: "v4", auth });
  }
  return cachedSheetsClient;
}

export { createOAuth2Client, loadCredentials, SCOPES, TOKEN_PATH, CREDENTIALS_PATH };

export interface GmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  threadId?: string;
  inReplyTo?: string;
  bcc?: string[];
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

export async function gmailSend(opts: GmailSendOptions): Promise<GmailSendResult> {
  const {
    to,
    subject,
    html,
    text,
    fromName,
    fromAddress,
    replyTo,
    threadId,
    inReplyTo,
    bcc,
  } = opts;

  try {
    await assertSenderIdentity(fromAddress);
    const gmail = getGmailClient();

    // Build RFC 2822 MIME using nodemailer's stream transport
    const transport = createTransport({ streamTransport: true });

    const headers: Record<string, string> = {};
    if (inReplyTo) {
      headers["In-Reply-To"] = inReplyTo;
      headers["References"] = inReplyTo;
    }

    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      ...(hasHtmlTags ? { html, text } : { text: html }),
      replyTo: replyTo ?? fromAddress,
      headers,
      ...(bcc && bcc.length > 0 ? { bcc } : {}),
    });

    // Read the MIME message from the stream
    const chunks: Buffer[] = [];
    for await (const chunk of info.message) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const requestBody: gmail_v1.Schema$Message = { raw };
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody,
    });

    return {
      success: true,
      messageId: res.data.id ?? undefined,
      threadId: res.data.threadId ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function threadHasReply(
  threadId: string,
  senderEmail: string
): Promise<boolean> {
  try {
    const gmail = getGmailClient();
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From"],
    });

    const messages = res.data.messages ?? [];
    const senderLower = senderEmail.toLowerCase();

    // Check if any message in the thread is NOT from the sender (i.e., a reply from the contact)
    for (const msg of messages) {
      const fromHeader = msg.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "from"
      );
      if (!fromHeader?.value) continue;

      const fromLower = fromHeader.value.toLowerCase();
      if (!fromLower.includes(senderLower)) {
        return true;
      }
    }
    return false;
  } catch {
    // If thread not found or API error, assume no reply
    return false;
  }
}

export async function verifyGmailConnection(): Promise<boolean> {
  try {
    const gmail = getGmailClient();
    const res = await gmail.users.getProfile({ userId: "me" });
    const actual = res.data.emailAddress ?? "";
    const expected = env.EMAIL_FROM_ADDRESS;
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      console.error(
        `Gmail SENDER MISMATCH: authenticated as ${actual}, but EMAIL_FROM_ADDRESS=${expected}. ` +
          `Gmail will rewrite the From header. Re-auth the mailbox you want to send from with "pnpm email:auth".`,
      );
      return false;
    }
    console.log(`Gmail connected: ${actual} (matches EMAIL_FROM_ADDRESS)`);
    return true;
  } catch (err) {
    console.error(
      "Gmail connection failed:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Asserts the authenticated Gmail mailbox matches the expected sender address.
 * Result is cached for the lifetime of the process — first call hits the API,
 * subsequent calls are free.
 *
 * Throws if mismatched so every send via `gmailSend` is guarded — no campaign
 * can accidentally send under the wrong identity.
 */
let cachedAuthedAddress: string | null = null;
export async function assertSenderIdentity(expected: string): Promise<void> {
  const want = expected.toLowerCase();
  if (cachedAuthedAddress) {
    if (cachedAuthedAddress !== want) {
      throw new Error(
        `Gmail sender mismatch: authenticated as ${cachedAuthedAddress}, expected ${expected}. ` +
          `Re-auth with "pnpm email:auth".`,
      );
    }
    return;
  }
  const gmail = getGmailClient();
  const res = await gmail.users.getProfile({ userId: "me" });
  const actual = (res.data.emailAddress ?? "").toLowerCase();
  if (actual !== want) {
    throw new Error(
      `Gmail sender mismatch: authenticated as ${actual}, expected ${expected}. ` +
        `Gmail will rewrite the From header. Re-auth with "pnpm email:auth".`,
    );
  }
  cachedAuthedAddress = actual;
}
