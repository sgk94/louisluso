import "dotenv/config";
import { z } from "zod";
import { readFileSync } from "fs";

function verifyGitignore(): void {
  try {
    const gitignore = readFileSync(".gitignore", "utf-8");
    if (!gitignore.split("\n").some((line) => line.trim() === ".env")) {
      console.error("ABORT: .env is not listed in .gitignore. Refusing to run.");
      process.exit(1);
    }
  } catch {
    console.error("ABORT: No .gitignore found. Create one with '.env' before running.");
    process.exit(1);
  }
}

verifyGitignore();

const envSchema = z
  .object({
    // Transport selection
    EMAIL_TRANSPORT: z.enum(["smtp", "gmail"]).default("smtp"),
    // SMTP (required when transport=smtp)
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().default(587),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    // Gmail (required when transport=gmail)
    GMAIL_CLIENT_ID: z.string().optional(),
    GMAIL_CLIENT_SECRET: z.string().optional(),
    // Shared
    EMAIL_FROM_NAME: z.string().default("Ken Yoon"),
    EMAIL_FROM_ADDRESS: z.string().email("Must be a valid email"),
    // Rate limiting
    EMAIL_MAX_PER_HOUR: z.coerce.number().default(50),
    EMAIL_MAX_PER_DAY: z.coerce.number().default(2000),
    EMAIL_DELAY_MS: z.coerce.number().default(2000),
    // WooCommerce (existing)
    WC_CONSUMER_KEY: z.string().startsWith("ck_").optional(),
    WC_CONSUMER_SECRET: z.string().startsWith("cs_").optional(),
    WC_STORE_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.EMAIL_TRANSPORT === "smtp") {
      if (!data.EMAIL_HOST) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_HOST"], message: "SMTP host required when transport=smtp" });
      }
      if (!data.EMAIL_USER) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_USER"], message: "SMTP user required when transport=smtp" });
      }
      if (!data.EMAIL_PASS) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_PASS"], message: "SMTP password required when transport=smtp" });
      }
    }
    if (data.EMAIL_TRANSPORT === "gmail") {
      if (!data.GMAIL_CLIENT_ID) {
        ctx.addIssue({ code: "custom", path: ["GMAIL_CLIENT_ID"], message: "Gmail client ID required when transport=gmail" });
      }
      if (!data.GMAIL_CLIENT_SECRET) {
        ctx.addIssue({ code: "custom", path: ["GMAIL_CLIENT_SECRET"], message: "Gmail client secret required when transport=gmail" });
      }
    }
  });

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("Missing or invalid environment variables:");
  for (const issue of envResult.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nSee .env.example for required email variables.");
  process.exit(1);
}

export const env = envResult.data;
