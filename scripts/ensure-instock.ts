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

// --- All known OOS variant IDs (set via script + already OOS) ---
const OOS_VARIANT_IDS = new Set([
  // Set to OOS via script on 2026-03-04
  8266,  // 719 Brown
  8521,  // 722 Wine
  8885,  // LL4006 Wine Glossed C4
  8331,  // LC9017 Black C1
  8392,  // LC9021 Black C1
  8395,  // LC9021 Gray C24
  8422,  // LC9032 Gray C12
  8455,  // LC9034 Brown/Orange C18-1
  14269, // LC9041 Black C1
  14271, // LC9041 Wine C4
  14272, // LC9041 Purple C6
  14794, // LC9042 Light Brown C3-1
  14322, // LC9043 Black/Gold C1
  14323, // LC9043 Black/Silver C2
  14339, // LC9044 Black/Silver C1-2
  14341, // LC9044 Purple/Gold C11

  // Already OOS before the update (from stock-update-guide)
  // 719
  8264, // 719 Black — need to check ID, using SKU-based lookup below instead
  // We don't have variant IDs for the "already OOS" items, so we'll use SKU matching
]);

// SKUs of variants that should remain OOS (already OOS before our update)
const OOS_SKUS = new Set([
  // Junior
  "719-black", "719-brown",
  "720_wine",
  "721_Black/White",
  "722_black/white", "722_pink/wine", "722_wine",
  // Classic
  "LL4004-C1", "LL4004-C14", "LL4004-C23",
  "LL4005-C1", "LL4005-C4", "LL4005-C8",
  "LL4006-C1", "LL4006-C3", "LL4006-C23", "LL4006-C4",
  // London
  "LC9015-C22",
  "LC9017-C4", "LC9017-C8", "LC9017-C22", "LC9017-C1",
  "LC9018-C3",
  "LC9020-C1", "LC9020-C8",
  "LC9021-C8", "LC9021-C1", "LC9021-C24",
  "LC9022-C1", "LC9022-C4", "LC9022-C8", "LC9022-C25",
  "LC9031-C1", "LC9031-C22",
  "LC9032-C12",
  "LC9034-C18-1",
  "LC_9041_C1", "LC_9041_C4", "LC_9041_C6",
  "LC_9042_C1", "LC_9042_C3", "LC_9042_C7", "LC_9042_C3-1",
  "LC_9043_C1", "LC_9043_C2",
  "LC_9044_C1", "LC_9044_C9", "LC_9044_C1-2", "LC_9044_C11",
  "LC_9045_C1", "LC_9045_C3",
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

function sanitizeUrl(url: string): string {
  return url
    .replace(/consumer_key=[^&]+/, "consumer_key=***")
    .replace(/consumer_secret=[^&]+/, "consumer_secret=***");
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

function isOos(variantId: number, sku: string): boolean {
  if (OOS_VARIANT_IDS.has(variantId)) return true;
  if (OOS_SKUS.has(sku)) return true;
  return false;
}

async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");

  if (DRY_RUN) {
    console.log("*** DRY RUN — no changes will be made ***\n");
  }

  console.log("Fetching categories...\n");
  const categories = await wcGetAll<WcCategory>("/products/categories");

  // Only the 3 requested collections
  const targetIds: Record<string, number> = {};
  for (const cat of categories) {
    if (cat.slug === "junior-series") targetIds["Junior Series"] = cat.id;
    if (cat.slug === "classic" && cat.name === "Classic") targetIds["Classic"] = cat.id;
    if (cat.slug === "london-collection") targetIds["London Collection"] = cat.id;
  }

  console.log("Target collections:");
  for (const [name, id] of Object.entries(targetIds)) {
    console.log(`  - ${name} (id: ${id})`);
  }

  // Fetch all products
  const allProducts: WcProduct[] = [];
  const seenProductIds = new Set<number>();

  for (const [name, catId] of Object.entries(targetIds)) {
    console.log(`\nFetching products from "${name}"...`);
    const products = await wcGetAll<WcProduct>("/products", { category: String(catId) });
    for (const p of products) {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        allProducts.push(p);
      }
    }
    console.log(`  Found ${products.length} products`);
  }

  console.log(`\nTotal unique products: ${allProducts.length}`);
  console.log("\n--- Checking variants ---\n");

  let alreadyInStock = 0;
  let updated = 0;
  let skippedOos = 0;
  let failed = 0;

  for (const product of allProducts.sort((a, b) => a.name.localeCompare(b.name))) {
    if (product.variations.length === 0) continue;

    // Rate limit to avoid Wordfence blocks
    await new Promise((r) => setTimeout(r, 500));

    const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);

    for (const v of variations) {
      const color = v.attributes.map((a) => a.option).join(", ") || "unknown";
      const label = `${product.name} — ${color} (ID: ${v.id}, SKU: ${v.sku})`;

      // Skip variants that should be OOS
      if (isOos(v.id, v.sku)) {
        skippedOos++;
        continue;
      }

      // Already in stock — no action needed
      if (v.stock_status === "instock") {
        alreadyInStock++;
        continue;
      }

      // Needs to be set to instock
      console.log(`→ ${label} — currently "${v.stock_status}"`);

      if (!DRY_RUN) {
        try {
          await new Promise((r) => setTimeout(r, 300));
          await wcPut(`/products/${product.id}/variations/${v.id}`, {
            stock_status: "instock",
            manage_stock: false,
          });
          console.log(`  ✓ Set to instock`);
          updated++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ Failed: ${msg}`);
          failed++;
        }
      } else {
        console.log(`  (dry run — would set to instock)`);
        updated++;
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Already in stock:    ${alreadyInStock}`);
  console.log(`Set to instock:      ${updated}`);
  console.log(`Skipped (OOS list):  ${skippedOos}`);
  console.log(`Failed:              ${failed}`);
  if (DRY_RUN) {
    console.log("\n*** This was a dry run. Run without --dry-run to apply changes. ***");
  } else if (updated > 0) {
    console.log("\nDone! Remember to clear LiteSpeed Cache in WP Admin.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
