import { z } from "zod";

const envSchema = z.object({
  // Zoho OAuth
  ZOHO_CLIENT_ID: z.string().min(1, "ZOHO_CLIENT_ID is required"),
  ZOHO_CLIENT_SECRET: z.string().min(1, "ZOHO_CLIENT_SECRET is required"),
  ZOHO_REFRESH_TOKEN: z.string().min(1, "ZOHO_REFRESH_TOKEN is required"),
  ZOHO_ORG_ID: z.string().min(1, "ZOHO_ORG_ID is required"),
  ZOHO_API_BASE_URL: z
    .string()
    .url("ZOHO_API_BASE_URL must be a valid URL")
    .default("https://www.zohoapis.com"),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .min(1, "CLOUDINARY_CLOUD_NAME is required"),

  // Gmail
  GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID is required"),
  GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET is required"),
  GMAIL_REFRESH_TOKEN: z.string().min(1, "GMAIL_REFRESH_TOKEN is required"),

  // Node
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) _env = parseEnv();
    return _env[prop as keyof Env];
  },
});
