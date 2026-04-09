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

// --- OOS variant IDs (set via update-sg-stock.ts) ---
const OOS_VARIANT_IDS = new Set([
  8206,  // SG-1011 C2
  8568,  // SG-1015 C2
  10871, // SG-1034 C27
  11022, // SG-1035 C6
  11052, // SG-1035 C27
  11032, // SG-1036 C1
  11039, // SG-1037 C3
]);

// --- Already-OOS variants by normalized product model → color codes ---
// Keys are normalized (no hyphens): "SG1011", not "SG-1011"
const OOS_BY_PRODUCT = new Map<string, Set<string>>([
  ["SG1011", new Set(["C2", "C24"])],
  ["SG1012", new Set(["C2", "C3", "C8"])],
  ["SG1013", new Set(["C1", "C2", "C3", "C4", "C8"])],
  ["SG1014", new Set(["C2", "C3", "C4", "C6"])],
  ["SG1015", new Set(["C2", "C3", "C4", "C6", "C8"])],
  ["SG1030", new Set(["C1", "C3", "C4", "C7"])],
  ["SG1031", new Set(["C1", "C3", "C7"])],
  ["SG1032", new Set(["C4", "C6", "C27"])],
  ["SG1033", new Set(["C7"])],
  ["SG1034", new Set(["C1", "C3", "C7", "C27"])],
  ["SG1035", new Set(["C6", "C27"])],
  ["SG1036", new Set(["C1"])],
  ["SG1037", new Set(["C1", "C3", "C7"])],
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

// --- Extract color code from SKU ---
// Handles: "SG1011-C24", "SG1015-6" (no C prefix), "SG1031-4"
function extractColorCode(sku: string): string | null {
  // Match trailing code: "-C24", "-C3", "-6", "-4"
  const skuMatch = sku.match(/-(C?\d+(?:-\d+)?)\s*$/i);
  if (!skuMatch) return null;

  const raw = skuMatch[1].toUpperCase();
  // Normalize: if no "C" prefix, add it (e.g. "6" → "C6")
  return raw.startsWith("C") ? raw : `C${raw}`;
}

// --- Extract product model from name (e.g. "SG1011" from "SG1011" or "SG1031(Discontinued)") ---
function extractProductModel(name: string): string | null {
  const match = name.match(/\b(SG-?\d+)\b/i);
  if (!match) return null;
  // Normalize: remove hyphens → "SG1011"
  return match[1].replace(/-/g, "").toUpperCase();
}

function isOos(variantId: number, productName: string, sku: string): boolean {
  // Check known variant IDs
  if (OOS_VARIANT_IDS.has(variantId)) return true;

  // Check by product name + color code
  const model = extractProductModel(productName);
  if (!model) return false;

  const oosCodes = OOS_BY_PRODUCT.get(model);
  if (!oosCodes) return false;

  const colorCode = extractColorCode(sku);
  if (!colorCode) return false;

  return oosCodes.has(colorCode);
}

// --- Main ---
async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");

  if (DRY_RUN) {
    console.log("*** DRY RUN — no changes will be made ***\n");
  }

  console.log("SG Collection — Ensure In-Stock Script");
  console.log(`Store: ${env.WC_STORE_URL}\n`);

  // Discover SG category
  console.log("Fetching categories...");
  const categories = await wcGetAll<WcCategory>("/products/categories");

  const sgCategory = categories.find((c) => c.slug === "signature-series");

  if (!sgCategory) {
    console.error("Could not find SG/Signature category. Available categories:");
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

  console.log("--- Checking variants ---\n");

  let alreadyInStock = 0;
  let updated = 0;
  let skippedOos = 0;
  let failed = 0;

  for (const product of products.sort((a, b) => a.name.localeCompare(b.name))) {
    if (product.variations.length === 0) continue;

    // Rate limit to avoid Wordfence blocks
    await new Promise((r) => setTimeout(r, 500));

    const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);

    for (const v of variations) {
      const color = v.attributes.map((a) => a.option).join(", ") || "unknown";
      const label = `${product.name} — ${color} (ID: ${v.id}, SKU: ${v.sku})`;

      // Skip variants that should be OOS
      if (isOos(v.id, product.name, v.sku)) {
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
