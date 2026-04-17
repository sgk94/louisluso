import { createTransport, type Transporter } from "nodemailer";
import { env } from "./env.ts";
import { loadTemplate, type TemplateVars, type UtmParams } from "./templates.ts";
import { gmailSend, verifyGmailConnection } from "./gmail.ts";
import { logSentEmail } from "./sent-log.ts";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: {
        user: env.EMAIL_USER!,
        pass: env.EMAIL_PASS!,
      },
    });
  }
  return transporter;
}

export interface SendOptions {
  to: string;
  subject: string;
  template: string;
  vars: TemplateVars;
  replyTo?: string;
  threadId?: string;
  inReplyTo?: string;
  bcc?: string[];
  /** For sent-log: contact name */
  contactName?: string;
  /** For sent-log: contact company */
  contactCompany?: string;
  /** For sent-log: sequence name */
  sequenceName?: string;
  /** For sent-log: sequence step number */
  sequenceStep?: number;
  /** For sent-log: A/B subject variant label */
  subjectVariant?: string;
  /** For sent-log: contact segment (e.g., "vision-source", "distributor") */
  segment?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

function buildUtm(options: SendOptions): UtmParams | undefined {
  if (!options.sequenceName) return undefined;
  return {
    source: "email",
    medium: "sequence",
    campaign: options.sequenceName,
    content: options.sequenceStep != null ? `step${options.sequenceStep}` : undefined,
  };
}

export async function sendEmail(options: SendOptions): Promise<SendResult> {
  const result = env.EMAIL_TRANSPORT === "gmail"
    ? await sendViaGmail(options)
    : await sendViaSmtp(options);

  if (result.success) {
    const { text } = loadTemplate(options.template, options.vars);
    const subjectRendered = renderString(options.subject, options.vars);
    logSentEmail({
      to: options.to,
      name: options.contactName ?? "",
      company: options.contactCompany ?? "",
      sequence: options.sequenceName,
      step: options.sequenceStep,
      template: options.template,
      subject: subjectRendered,
      subjectVariant: options.subjectVariant,
      bodyText: text,
      messageId: result.messageId,
      threadId: result.threadId,
      transport: env.EMAIL_TRANSPORT,
      segment: options.segment,
    });
  }

  return result;
}

async function sendViaSmtp(options: SendOptions): Promise<SendResult> {
  const { to, subject, template, vars, replyTo, bcc } = options;

  const { html, text } = loadTemplate(template, vars, buildUtm(options));
  const subjectRendered = renderString(subject, vars);

  try {
    const info = await getTransporter().sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject: subjectRendered,
      html,
      text,
      replyTo: replyTo ?? env.EMAIL_FROM_ADDRESS,
      ...(bcc && bcc.length > 0 ? { bcc } : {}),
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

async function sendViaGmail(options: SendOptions): Promise<SendResult> {
  const { to, subject, template, vars, replyTo, threadId, inReplyTo, bcc } = options;

  const { html, text } = loadTemplate(template, vars, buildUtm(options));
  const subjectRendered = renderString(subject, vars);

  return gmailSend({
    to,
    subject: subjectRendered,
    html,
    text,
    fromName: env.EMAIL_FROM_NAME,
    fromAddress: env.EMAIL_FROM_ADDRESS,
    replyTo: replyTo ?? env.EMAIL_FROM_ADDRESS,
    threadId,
    inReplyTo,
    bcc,
  });
}

function renderString(str: string, vars: TemplateVars): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

export async function verifyConnection(): Promise<boolean> {
  if (env.EMAIL_TRANSPORT === "gmail") {
    return verifyGmailConnection();
  }
  try {
    await getTransporter().verify();
    return true;
  } catch (err) {
    console.error("SMTP connection failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
