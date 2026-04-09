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
interface VariantToUpdate {
  productName: string;
  color: string;
  sku: string; // product SKU prefix to search for
}

// --- The 15 variants to mark out of stock ---
const VARIANTS_TO_UPDATE: VariantToUpdate[] = [
  // Junior Collection
  { productName: "719", color: "Brown", sku: "719" },
  { productName: "722", color: "Wine", sku: "722" },

  // Classic Collection
  { productName: "LL4006", color: "Wine Glossed (C4)", sku: "LL4006" },

  // London Collection
  { productName: "LC9017", color: "Black (C1)", sku: "LC9017" },
  { productName: "LC9021", color: "Black (C1)", sku: "LC9021" },
  { productName: "LC9021", color: "Gray (C24)", sku: "LC9021" },
  { productName: "LC9032", color: "Gray (C12)", sku: "LC9032" },
  { productName: "LC9034", color: "Brown/Orange (C18-1)", sku: "LC9034" },
  { productName: "LC9041", color: "Black (C1)", sku: "LC9041" },
  { productName: "LC9041", color: "Wine (C4)", sku: "LC9041" },
  { productName: "LC9041", color: "Purple (C6)", sku: "LC9041" },
  { productName: "LC9042", color: "Light Brown (C3-1)", sku: "LC9042" },
  { productName: "LC9043", color: "Black/Gold (C1)", sku: "LC9043" },
  { productName: "LC9043", color: "Black/Silver (C2)", sku: "LC9043" },
  { productName: "LC9044", color: "Black/Silver (C1-2)", sku: "LC9044" },
  { productName: "LC9044", color: "Purple/Gold (C11)", sku: "LC9044" },
];

// --- WooCommerce API helpers ---
function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`/wp-json/wc/v3${path}`, env.WC_STORE_URL);
  url.searchParams.set("consumer_key", env.WC_CONSUMER_KEY);
  url.searchParams.set("consumer_secret", env.WC_CONSUMER_SECRET);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function sanitizeUrl(url: string): string {
  return url.replace(/consumer_key=[^&]+/, "consumer_key=***").replace(/consumer_secret=[^&]+/, "consumer_secret=***");
}

async function wcGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${sanitizeUrl(url)} → ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
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

// --- WooCommerce types (minimal) ---
interface WcProduct {
  id: number;
  name: string;
  sku: string;
  slug: string;
  variations: number[];
}

interface WcVariation {
  id: number;
  sku: string;
  stock_status: string;
  attributes: { name: string; option: string }[];
}

// --- Lookup logic ---
async function findProduct(sku: string): Promise<WcProduct | undefined> {
  // Search by SKU
  const products = await wcGet<WcProduct[]>("/products", {
    search: sku,
    per_page: "100",
  });

  // Try exact SKU match first, then partial name/slug match
  return (
    products.find((p) => p.sku.toLowerCase() === sku.toLowerCase()) ??
    products.find((p) => p.name.toLowerCase().includes(sku.toLowerCase()) || p.slug.toLowerCase().includes(sku.toLowerCase()))
  );
}

async function findVariation(productId: number, colorLabel: string): Promise<WcVariation | undefined> {
  const variations = await wcGet<WcVariation[]>(`/products/${productId}/variations`, {
    per_page: "100",
  });

  const normalizedColor = colorLabel.toLowerCase().trim();

  return variations.find((v) =>
    v.attributes.some((attr) => {
      const option = attr.option.toLowerCase().trim();
      // Try exact match, then check if one contains the other
      return option === normalizedColor || option.includes(normalizedColor) || normalizedColor.includes(option);
    })
  );
}

// --- Main ---
async function main(): Promise<void> {
  console.log("WooCommerce Stock Updater");
  console.log(`Store: ${env.WC_STORE_URL}`);
  console.log(`Variants to update: ${VARIANTS_TO_UPDATE.length}`);
  console.log("---");

  // Deduplicate product lookups
  const uniqueSkus = [...new Set(VARIANTS_TO_UPDATE.map((v) => v.sku))];
  const productCache = new Map<string, WcProduct | null>();

  console.log(`\nLooking up ${uniqueSkus.length} products...`);

  for (const sku of uniqueSkus) {
    try {
      const product = await findProduct(sku);
      if (product) {
        productCache.set(sku, product);
        console.log(`  Found: ${sku} → product ID ${product.id} ("${product.name}")`);
      } else {
        productCache.set(sku, null);
        console.error(`  Not found: ${sku}`);
      }
    } catch (error) {
      productCache.set(sku, null);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error looking up ${sku}: ${message}`);
    }
  }

  console.log("\n--- Updating variants ---\n");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const variant of VARIANTS_TO_UPDATE) {
    const label = `${variant.productName} — ${variant.color}`;
    const product = productCache.get(variant.sku);

    if (!product) {
      console.error(`\u2717 ${label} — skipped (product not found)`);
      skipped++;
      continue;
    }

    try {
      const variation = await findVariation(product.id, variant.color);

      if (!variation) {
        console.error(`\u2717 ${label} — variant not found on product ${product.id}`);
        failed++;
        continue;
      }

      if (variation.stock_status === "outofstock") {
        console.log(`- ${label} — already out of stock (variation ${variation.id})`);
        succeeded++;
        continue;
      }

      await wcPut(`/products/${product.id}/variations/${variation.id}`, {
        stock_status: "outofstock",
        stock_quantity: 0,
      });

      console.log(`\u2713 ${label} → out of stock (variation ${variation.id})`);
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\u2717 ${label} — failed: ${message}`);
      failed++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Total:     ${VARIANTS_TO_UPDATE.length}`);

  if (failed > 0 || skipped > 0) {
    console.log("\nSome updates failed or were skipped. Review the output above.");
    process.exit(1);
  }

  console.log("\nAll variants updated successfully!");
  console.log("Next steps:");
  console.log("  1. Clear WP Rocket cache (WP Admin → WP Rocket → Clear Cache)");
  console.log("  2. Spot-check products on https://louisluso.com");
}

main();
