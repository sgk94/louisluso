import "dotenv/config";
import { z } from "zod";
import { readFileSync } from "fs";

// --- Security: verify .env is gitignored ---
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

// --- Env validation ---
const envSchema = z.object({
  WC_CONSUMER_KEY: z.string().startsWith("ck_", "Must start with ck_"),
  WC_CONSUMER_SECRET: z.string().startsWith("cs_", "Must start with cs_"),
  WC_STORE_URL: z.string().url("Must be a valid URL"),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("Missing or invalid environment variables:");
  for (const issue of envResult.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nCopy .env.example to .env and fill in your WooCommerce API keys.");
  process.exit(1);
}

const env = envResult.data;

// --- Types ---
interface SgVariant {
  product: string;
  code: string;
  color: string;
  productId: number;
  variantId: number;
}

// --- 7 SG variants to mark out of stock ---
const VARIANTS: SgVariant[] = [
  { product: "SG-1011", code: "C2", color: "Black Matte", productId: 8204, variantId: 8206 },
  { product: "SG-1015", code: "C2", color: "Black Matte", productId: 8529, variantId: 8568 },
  { product: "SG-1034", code: "C27", color: "Pink", productId: 9140, variantId: 10871 },
  { product: "SG-1035", code: "C6", color: "Purple Glossed", productId: 11018, variantId: 11022 },
  { product: "SG-1035", code: "C27", color: "Pink", productId: 11018, variantId: 11052 },
  { product: "SG-1036", code: "C1", color: "Black Glossed", productId: 11031, variantId: 11032 },
  { product: "SG-1037", code: "C3", color: "Brown Glossed", productId: 11037, variantId: 11039 },
];

// --- WooCommerce API helpers ---
function buildUrl(path: string): string {
  const url = new URL(`/wp-json/wc/v3${path}`, env.WC_STORE_URL);
  url.searchParams.set("consumer_key", env.WC_CONSUMER_KEY);
  url.searchParams.set("consumer_secret", env.WC_CONSUMER_SECRET);
  return url.toString();
}

function sanitizeUrl(url: string): string {
  return url
    .replace(/consumer_key=[^&]+/, "consumer_key=***")
    .replace(/consumer_secret=[^&]+/, "consumer_secret=***");
}

async function wcPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`PUT ${sanitizeUrl(url)} → ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function wcGet<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${sanitizeUrl(url)} → ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---
async function main(): Promise<void> {
  console.log("SG Collection — Out of Stock Updater");
  console.log(`Store: ${env.WC_STORE_URL}`);
  console.log(`Variants to update: ${VARIANTS.length}`);
  console.log("---\n");

  let succeeded = 0;
  let alreadyOos = 0;
  let failed = 0;

  for (const v of VARIANTS) {
    const label = `${v.product} ${v.code} — ${v.color} (var ${v.variantId})`;

    try {
      // Check current status first
      const current = await wcGet<{ stock_status: string }>(
        `/products/${v.productId}/variations/${v.variantId}`
      );

      if (current.stock_status === "outofstock") {
        console.log(`- ${label} — already OOS`);
        alreadyOos++;
        await sleep(500);
        continue;
      }

      await wcPut(`/products/${v.productId}/variations/${v.variantId}`, {
        stock_status: "outofstock",
        stock_quantity: 0,
      });

      console.log(`✓ ${label} → out of stock`);
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${label} — failed: ${message}`);
      failed++;
    }

    await sleep(500);
  }

  console.log("\n--- Summary ---");
  console.log(`Updated:     ${succeeded}`);
  console.log(`Already OOS: ${alreadyOos}`);
  console.log(`Failed:      ${failed}`);
  console.log(`Total:       ${VARIANTS.length}`);

  if (failed > 0) {
    console.log("\nSome updates failed. Review the output above.");
    process.exit(1);
  }

  console.log("\nAll done!");
  console.log("Next steps:");
  console.log("  1. Clear LiteSpeed Cache (Purge All) via WP Admin");
  console.log("  2. Spot-check SG-1035, SG-1036 on https://louisluso.com");
}

main();
