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

// --- Restock list: model → color → quantity ---
const RESTOCK: Map<string, Map<string, number>> = new Map([
  ["SG1011", new Map([["C2", 20], ["C6", 10], ["C24", 20]])],
  ["SG1012", new Map([["C2", 10], ["C3", 10], ["C4", 10], ["C8", 10], ["C24", 10]])],
  ["SG1013", new Map([["C1", 20], ["C2", 20], ["C3", 20], ["C4", 20], ["C8", 20]])],
  ["SG1015", new Map([["C2", 20], ["C3", 20], ["C4", 20], ["C8", 20]])],
  ["LC9018", new Map([["C1", 10], ["C24", 10]])],
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
  manage_stock: boolean;
  attributes: { name: string; option: string }[];
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// --- Extract color code from SKU ---
// Handles: "SG1011-C24", "SG1015-6" (no C prefix), "SG1031-4", "LC9018-C1"
function extractColorCode(sku: string): string | null {
  const skuMatch = sku.match(/-(C?\d+(?:-\d+)?)\s*$/i);
  if (!skuMatch) return null;

  const raw = skuMatch[1].toUpperCase();
  return raw.startsWith("C") ? raw : `C${raw}`;
}

// --- Extract product model from name or SKU ---
// Handles SG and LC prefixes: "SG1011", "SG-1011", "LC9018", "L-9018"
function extractProductModel(name: string): string | null {
  const match = name.match(/\b((?:SG|LC)-?\d+)\b/i);
  if (!match) return null;
  return match[1].replace(/-/g, "").toUpperCase();
}

// --- Extract model from variant SKU (more reliable than product name) ---
// "SG1012-C4" → "SG1012", "LC9018-C1" → "LC9018"
function extractModelFromSku(sku: string): string | null {
  const match = sku.match(/^((?:SG|LC)\d+)/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

// --- Main ---
async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");

  if (DRY_RUN) {
    console.log("*** DRY RUN — no changes will be made ***\n");
  }

  console.log("Restock Script — 2026-03-09");
  console.log(`Store: ${env.WC_STORE_URL}`);
  console.log(`Variants to restock: 19 across 5 products\n`);

  // --- Fetch SG products from signature-series category ---
  console.log("Fetching categories...");
  const categories = await wcGetAll<WcCategory>("/products/categories");
  const sgCategory = categories.find((c) => c.slug === "signature-series");

  if (!sgCategory) {
    console.error("Could not find signature-series category.");
    process.exit(1);
  }

  console.log(`Found category: "${sgCategory.name}" (id: ${sgCategory.id})\n`);

  console.log("Fetching SG products...");
  const sgProducts = await wcGetAll<WcProduct>("/products", { category: String(sgCategory.id) });
  console.log(`Found ${sgProducts.length} SG products`);

  // --- Fetch LC9018 by search ---
  console.log("Searching for LC9018...");
  const lcProducts = await wcGet<WcProduct[]>("/products", { search: "LC9018", per_page: "10" });
  const lc9018 = lcProducts.find((p) => {
    const model = extractProductModel(p.name);
    return model === "LC9018";
  });

  if (!lc9018) {
    console.warn("WARNING: Could not find LC9018 product. Will skip L-9018 variants.");
  } else {
    console.log(`Found LC9018: "${lc9018.name}" (id: ${lc9018.id})`);
  }

  // Combine all products to process
  const allProducts: WcProduct[] = [...sgProducts];
  if (lc9018 && !allProducts.some((p) => p.id === lc9018.id)) {
    allProducts.push(lc9018);
  }

  console.log("\n--- Processing variants ---\n");

  let updated = 0;
  let notFound = 0;
  let failed = 0;
  const foundVariants = new Set<string>(); // track "MODEL:COLOR" matches

  for (const product of allProducts.sort((a, b) => a.name.localeCompare(b.name))) {
    if (product.variations.length === 0) continue;

    // Rate limit between products
    await new Promise((r) => setTimeout(r, 500));

    const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);

    let productHasRestockVariants = false;

    for (const v of variations) {
      // Use SKU-based model (more reliable than product name)
      const skuModel = extractModelFromSku(v.sku);
      if (!skuModel) continue;

      const restockColors = RESTOCK.get(skuModel);
      if (!restockColors) continue;

      const colorCode = extractColorCode(v.sku);
      if (!colorCode) continue;

      const qty = restockColors.get(colorCode);
      if (qty === undefined) continue;

      if (!productHasRestockVariants) {
        console.log(`${product.name} (id: ${product.id}, SKU model: ${skuModel})`);
        productHasRestockVariants = true;
      }

      const color = v.attributes.map((a) => a.option).join(", ") || colorCode;
      const label = `  ${color} (ID: ${v.id}, SKU: ${v.sku})`;
      foundVariants.add(`${skuModel}:${colorCode}`);

      console.log(`${label} — qty: ${qty}`);

      if (!DRY_RUN) {
        try {
          await new Promise((r) => setTimeout(r, 300));
          await wcPut(`/products/${product.id}/variations/${v.id}`, {
            stock_status: "instock",
            manage_stock: true,
            stock_quantity: qty,
          });
          console.log(`    ✓ Set to instock, qty=${qty}`);
          updated++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`    ✗ Failed: ${msg}`);
          failed++;
        }
      } else {
        console.log(`    (dry run — would set to instock, qty=${qty})`);
        updated++;
      }
    }

    if (productHasRestockVariants) {
      console.log();
    }
  }

  // Check for any variants we didn't find
  console.log("--- Missing variant check ---\n");
  for (const [model, colors] of RESTOCK) {
    for (const [color] of colors) {
      const key = `${model}:${color}`;
      if (!foundVariants.has(key)) {
        console.warn(`WARNING: ${model} ${color} — not found in WooCommerce`);
        notFound++;
      }
    }
  }

  if (notFound === 0) {
    console.log("All 19 variants found.\n");
  }

  console.log("=== SUMMARY ===");
  console.log(`Updated:    ${updated}`);
  console.log(`Not found:  ${notFound}`);
  console.log(`Failed:     ${failed}`);

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
