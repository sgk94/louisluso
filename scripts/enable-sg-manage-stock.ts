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
  manage_stock: boolean;
  stock_quantity: number | null;
  categories: { id: number; name: string; slug: string }[];
  variations: number[];
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// --- Main ---
async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");

  if (DRY_RUN) {
    console.log("*** DRY RUN — no changes will be made ***\n");
  }

  console.log("SG Collection — Enable manage_stock on Parent Products");
  console.log(`Store: ${env.WC_STORE_URL}\n`);

  // Discover SG category
  console.log("Fetching categories...");
  const categories = await wcGetAll<WcCategory>("/products/categories");

  const sgCategory = categories.find((c) => c.slug === "signature-series");

  if (!sgCategory) {
    console.error("Could not find Signature Series category. Available categories:");
    for (const c of categories.sort((a, b) => a.name.localeCompare(b.name))) {
      console.error(`  - ${c.name} (slug: ${c.slug}, id: ${c.id}, count: ${c.count})`);
    }
    process.exit(1);
  }

  console.log(`Found category: "${sgCategory.name}" (slug: ${sgCategory.slug}, id: ${sgCategory.id}, count: ${sgCategory.count})\n`);

  // Fetch all SG products
  console.log("Fetching SG products...");
  const products = await wcGetAll<WcProduct>("/products", { category: String(sgCategory.id) });
  console.log(`Found ${products.length} products\n`);

  console.log("--- Checking parent products ---\n");

  const alreadyManaged: { name: string; id: number }[] = [];
  const updated: { name: string; id: number }[] = [];
  const failed: { name: string; id: number; error: string }[] = [];

  for (const product of products.sort((a, b) => a.name.localeCompare(b.name))) {
    const label = `${product.name} (ID: ${product.id})`;

    if (product.manage_stock) {
      console.log(`✓ ${label} — already has manage_stock: true (qty: ${product.stock_quantity})`);
      alreadyManaged.push({ name: product.name, id: product.id });
      continue;
    }

    console.log(`→ ${label} — manage_stock: false, stock_quantity: ${product.stock_quantity}`);

    if (!DRY_RUN) {
      try {
        // Rate limit to avoid Wordfence blocks
        await new Promise((r) => setTimeout(r, 500));
        await wcPut(`/products/${product.id}`, {
          manage_stock: true,
          stock_quantity: 20,
        });
        console.log(`  ✓ Set manage_stock: true, stock_quantity: 20`);
        updated.push({ name: product.name, id: product.id });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed: ${msg}`);
        failed.push({ name: product.name, id: product.id, error: msg });
      }
    } else {
      console.log(`  (dry run — would set manage_stock: true, stock_quantity: 20)`);
      updated.push({ name: product.name, id: product.id });
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Already managed:  ${alreadyManaged.length}`);
  if (alreadyManaged.length > 0) {
    for (const p of alreadyManaged) {
      console.log(`  - ${p.name} (${p.id})`);
    }
  }
  console.log(`Updated:          ${updated.length}`);
  if (updated.length > 0) {
    for (const p of updated) {
      console.log(`  - ${p.name} (${p.id})`);
    }
  }
  console.log(`Failed:           ${failed.length}`);
  if (failed.length > 0) {
    for (const p of failed) {
      console.log(`  - ${p.name} (${p.id}): ${p.error}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n*** This was a dry run. Run without --dry-run to apply changes. ***");
  } else if (updated.length > 0) {
    console.log("\nDone! Remember to clear LiteSpeed Cache in WP Admin.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
