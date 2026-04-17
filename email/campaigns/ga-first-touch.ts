/**
 * GA first-touch campaign — 4 sends for the Apr 17 Atlanta trip.
 *
 * Default = DRY RUN (shows rendered content, verifies connection, no send).
 * Pass --live to actually send.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config email/campaigns/ga-first-touch.ts
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config email/campaigns/ga-first-touch.ts --live
 */
import "dotenv/config";
import { sendEmail, verifyConnection } from "../send.ts";
import { loadTemplate } from "../templates.ts";

const SUBJECT = "Visiting Atlanta Apr 17: introducing LOUISLUSO";
const TEMPLATE = "trip-visit";
const BCC = ["shawn@louisluso.com", "admin@louisluso.com"];
const AREA = "the Atlanta area";
const DATES = "April 17";

interface Contact {
  email: string;
  name: string; // greeting name; blank = generic "Hello"
  company: string;
  area?: string; // override default AREA for outlier cities
}

const CONTACTS: Contact[] = [
  {
    email: "chasidy@advancedeye2020.com",
    name: "Chasidy",
    company: "Advanced Eyecare Center",
    area: "your area", // Perry, GA is ~2hr south of Atlanta
  },
  {
    email: "aiden@joynus.com",
    name: "Aiden",
    company: "Joynus",
  },
  {
    email: "jy@lolkousa.com",
    name: "Jae Yoo",
    company: "LOLKO",
  },
  {
    email: "roswellpearle@gmail.com",
    name: "", // triggers generic "Hello" greeting below
    company: "Pearle Vision Roswell",
  },
];

async function main() {
  const live = process.argv.includes("--live");
  console.log(`Mode: ${live ? "LIVE — SENDING" : "DRY RUN — preview only"}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`BCC: ${BCC.join(", ")}`);
  console.log(`Contacts: ${CONTACTS.length}\n`);

  if (live) {
    const ok = await verifyConnection();
    if (!ok) {
      console.error("Connection check failed — aborting before sends.");
      process.exit(1);
    }
  }

  let ok = 0;
  let fail = 0;

  for (const c of CONTACTS) {
    const greeting = c.name.trim() ? `Hi ${c.name}` : "Hello";
    const vars = {
      greeting,
      company: c.company,
      area: c.area ?? AREA,
      dates: DATES,
    };

    // Render preview
    const rendered = loadTemplate(TEMPLATE, vars);
    console.log(`── ${c.email} (${c.company}) ──`);
    console.log(`Greeting: ${greeting},`);
    console.log(rendered.text.split("\n").slice(0, 3).join("\n"));
    console.log("...");

    if (!live) continue;

    const res = await sendEmail({
      to: c.email,
      subject: SUBJECT,
      template: TEMPLATE,
      vars,
      bcc: BCC,
      contactName: c.name || "(generic)",
      contactCompany: c.company,
      sequenceName: "ga-first-touch-2026-04",
      sequenceStep: 1,
    });

    if (res.success) {
      console.log(`  [OK] messageId=${res.messageId}`);
      ok++;
    } else {
      console.error(`  [FAIL] ${res.error}`);
      fail++;
    }
    // Gentle pause between sends
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (live) {
    console.log(`\nDone. ok=${ok} fail=${fail}`);
  } else {
    console.log(
      "\nDry run complete. Review previews above, then re-run with --live to send.",
    );
  }
}

main().catch((e) => {
  console.error("Campaign failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
