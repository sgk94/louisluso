import "dotenv/config";
import { z } from "zod";
import { readFileSync } from "fs";

// --- Security: verify .env is gitignored ---
function verifyGitignore(): void {
  try {
    const gitignore = readFileSync(".gitignore", "utf-8");
    if (!gitignore.split("\n").some((line) => line.trim() === ".env")) {
      console.error("ABORT: .env is not listed in .gitignore.");
      process.exit(1);
    }
  } catch {
    console.error("ABORT: No .gitignore found.");
    process.exit(1);
  }
}

verifyGitignore();

const envSchema = z.object({
  WC_CONSUMER_KEY: z.string().startsWith("ck_"),
  WC_CONSUMER_SECRET: z.string().startsWith("cs_"),
  WC_STORE_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

// --- Known OOS variant IDs (from the March 4 update + already OOS) ---
// These are all the variants that were set to OOS or were already OOS
const KNOWN_OOS_VARIANT_IDS = new Set([
  // Set to OOS via script
  8266, 8521, 8885, 8331, 8392, 8395, 8422, 8455,
  14269, 14271, 14272, 14794, 14322, 14323, 14339, 14341,
]);

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

async function wcGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${path} → ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

interface WcProduct {
  id: number;
  name: string;
  sku: string;
  categories: { id: number; name: string; slug: string }[];
  variations: number[];
}

interface WcVariation {
  id: number;
  sku: string;
  stock_status: string;
  stock_quantity: number | null;
  attributes: { name: string; option: string }[];
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// Fetch all pages of a paginated endpoint
async function wcGetAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const batch = await wcGet<T[]>(path, { ...params, per_page: "100", page: String(page) });
    results.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return results;
}

async function main(): Promise<void> {
  console.log("Fetching product categories...\n");

  // First, find the category IDs for our three collections
  const categories = await wcGetAll<WcCategory>("/products/categories");

  const targetSlugs = ["junior-series", "classic", "london-collection"];
  const targetNames = ["junior", "classic", "london"];

  const matchedCategories = categories.filter(
    (c) =>
      targetSlugs.some((s) => c.slug.includes(s)) ||
      targetNames.some((n) => c.name.toLowerCase().includes(n))
  );

  console.log("Matched categories:");
  for (const cat of matchedCategories) {
    console.log(`  - ${cat.name} (id: ${cat.id}, slug: ${cat.slug}, ${cat.count} products)`);
  }

  if (matchedCategories.length === 0) {
    console.log("\nNo matching categories found. Listing all categories:");
    for (const cat of categories) {
      console.log(`  - ${cat.name} (id: ${cat.id}, slug: ${cat.slug}, ${cat.count} products)`);
    }
    return;
  }

  // Fetch all products from each category
  const allProducts: WcProduct[] = [];
  const seenProductIds = new Set<number>();

  for (const cat of matchedCategories) {
    console.log(`\nFetching products from "${cat.name}"...`);
    const products = await wcGetAll<WcProduct>("/products", { category: String(cat.id) });
    for (const p of products) {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        allProducts.push(p);
      }
    }
    console.log(`  Found ${products.length} products`);
  }

  console.log(`\nTotal unique products: ${allProducts.length}`);
  console.log("\n=== REMAINING IN-STOCK VARIANTS ===\n");

  let totalInStock = 0;
  let totalOOS = 0;

  for (const product of allProducts.sort((a, b) => a.name.localeCompare(b.name))) {
    if (product.variations.length === 0) continue;

    // Add delay to avoid Wordfence rate limiting
    await new Promise((r) => setTimeout(r, 500));

    const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);

    const inStockVariants = variations.filter((v) => v.stock_status === "instock");
    const oosVariants = variations.filter((v) => v.stock_status === "outofstock");

    totalOOS += oosVariants.length;

    if (inStockVariants.length > 0) {
      const catNames = product.categories.map((c) => c.name).join(", ");
      console.log(`${product.name} [${catNames}]`);
      for (const v of inStockVariants) {
        const color = v.attributes.map((a) => a.option).join(", ") || "unknown";
        const qty = v.stock_quantity !== null ? ` (qty: ${v.stock_quantity})` : "";
        console.log(`  ✓ IN STOCK: ${color} — ID: ${v.id}, SKU: ${v.sku}${qty}`);
        totalInStock++;
      }
      console.log();
    }
  }

  console.log("=== SUMMARY ===");
  console.log(`Total in-stock variants: ${totalInStock}`);
  console.log(`Total out-of-stock variants: ${totalOOS}`);
  console.log(`Total products checked: ${allProducts.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
