import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export type TemplateVars = Record<string, string>;

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dir, "templates");

export interface RenderedTemplate {
  html: string;
  text: string;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

export function loadTemplate(
  name: string,
  vars: TemplateVars,
  utm?: UtmParams
): RenderedTemplate {
  const htmlPath = join(TEMPLATES_DIR, `${name}.html`);
  const textPath = join(TEMPLATES_DIR, `${name}.txt`);

  if (!existsSync(htmlPath)) {
    throw new Error(`Template not found: ${htmlPath}`);
  }

  let html = render(readFileSync(htmlPath, "utf-8"), vars);
  let text = existsSync(textPath)
    ? render(readFileSync(textPath, "utf-8"), vars)
    : stripHtml(html);

  if (utm) {
    html = injectUtmParams(html, utm);
    text = injectUtmParams(text, utm);
  }

  return { html, text };
}

function render(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function injectUtmParams(content: string, utm: UtmParams): string {
  const params = new URLSearchParams();
  if (utm.source) params.set("utm_source", utm.source);
  if (utm.medium) params.set("utm_medium", utm.medium);
  if (utm.campaign) params.set("utm_campaign", utm.campaign);
  if (utm.content) params.set("utm_content", utm.content);

  const utmString = params.toString();
  if (!utmString) return content;

  // Inject into href URLs (HTML links)
  return content.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (match, url: string) => {
      const separator = url.includes("?") ? "&" : "?";
      return `href="${url}${separator}${utmString}"`;
    }
  );
}

export function listTemplates(): string[] {
  const { readdirSync } = require("fs") as typeof import("fs");
  return readdirSync(TEMPLATES_DIR)
    .filter((f: string) => f.endsWith(".html"))
    .map((f: string) => f.replace(".html", ""));
}
