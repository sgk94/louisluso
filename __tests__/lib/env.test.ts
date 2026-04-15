import { describe, it, expect, vi, beforeEach } from "vitest";

const VALID_ENV = {
  ZOHO_CLIENT_ID: "test-client-id",
  ZOHO_CLIENT_SECRET: "test-client-secret",
  ZOHO_REFRESH_TOKEN: "test-refresh-token",
  ZOHO_ORG_ID: "test-org-id",
  CLERK_SECRET_KEY: "sk_test_123",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-api-key",
  CLOUDINARY_API_SECRET: "test-api-secret",
  GMAIL_CLIENT_ID: "gmail-client-id",
  GMAIL_CLIENT_SECRET: "gmail-client-secret",
  GMAIL_REFRESH_TOKEN: "gmail-refresh-token",
  PARTNER_APP_NOTIFY_EMAIL: "notify-test@example.com",
  ZOHO_WEBHOOK_SECRET: "test-secret-that-is-at-least-32-chars-aaaa",
  NEXT_PUBLIC_MAPBOX_TOKEN: "pk.test-mapbox-token",
} as const;

describe("env", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parses valid env vars correctly", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }

    const { env } = await import("@/lib/env");

    expect(env.ZOHO_CLIENT_ID).toBe("test-client-id");
    expect(env.ZOHO_CLIENT_SECRET).toBe("test-client-secret");
    expect(env.ZOHO_REFRESH_TOKEN).toBe("test-refresh-token");
    expect(env.ZOHO_ORG_ID).toBe("test-org-id");
    expect(env.ZOHO_API_BASE_URL).toBe("https://www.zohoapis.com");
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_123");
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test_123");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.upstash.io");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("test-redis-token");
    expect(env.CLOUDINARY_CLOUD_NAME).toBe("test-cloud");
    expect(env.GMAIL_CLIENT_ID).toBe("gmail-client-id");
    expect(env.GMAIL_CLIENT_SECRET).toBe("gmail-client-secret");
    expect(env.GMAIL_REFRESH_TOKEN).toBe("gmail-refresh-token");
    expect(env.NODE_ENV).toBe("test");
  });

  it("applies default for ZOHO_API_BASE_URL", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }

    const { env } = await import("@/lib/env");

    expect(env.ZOHO_API_BASE_URL).toBe("https://www.zohoapis.com");
  });

  it("allows overriding ZOHO_API_BASE_URL", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("ZOHO_API_BASE_URL", "https://custom.zohoapis.com");

    const { env } = await import("@/lib/env");

    expect(env.ZOHO_API_BASE_URL).toBe("https://custom.zohoapis.com");
  });

  it("allows overriding NODE_ENV", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("NODE_ENV", "production");

    const { env } = await import("@/lib/env");

    expect(env.NODE_ENV).toBe("production");
  });

  it("throws on first property access when required env vars are missing", async () => {
    const { env } = await import("@/lib/env");

    expect(() => env.ZOHO_CLIENT_ID).toThrow("Invalid environment variables");
  });

  it("throws on first access when a single required var is missing", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("ZOHO_CLIENT_ID", "");

    const { env } = await import("@/lib/env");

    expect(() => env.ZOHO_CLIENT_ID).toThrow("ZOHO_CLIENT_ID is required");
  });

  it("throws on first access when UPSTASH_REDIS_REST_URL is not a valid URL", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "not-a-url");

    const { env } = await import("@/lib/env");

    expect(() => env.UPSTASH_REDIS_REST_URL).toThrow(
      "UPSTASH_REDIS_REST_URL must be a valid URL",
    );
  });

  it("throws on first access when NODE_ENV is an invalid value", async () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("NODE_ENV", "staging");

    const { env } = await import("@/lib/env");

    expect(() => env.NODE_ENV).toThrow("Invalid environment variables");
  });
});
