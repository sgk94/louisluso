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
const DRY_RUN = process.argv.includes("--dry-run");
const API_DELAY_MS = 1000; // Delay between API calls to avoid Wordfence rate limiting

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  regular_price: string;
  price: string;
  type: string;
  status: string;
  categories: { id: number; name: string; slug: string }[];
}

function isManomosProduct(product: WcProduct): boolean {
  return product.categories.some((c) =>
    c.name.toLowerCase().includes("manomos")
  );
}

function isManomosGlasses(product: WcProduct): boolean {
  return product.categories.some((c) =>
    c.name.toLowerCase().includes("manomos glasses")
  );
}

function isManomosCategory(product: WcProduct, type: "glasses" | "sunglasses"): boolean {
  return product.categories.some((c) => {
    const name = c.name.toLowerCase();
    return type === "glasses"
      ? name.includes("manomos glasses")
      : name.includes("manomos sunglasses");
  });
}

interface WcVariation {
  id: number;
  sku: string;
  regular_price: string;
  price: string;
  stock_status: string;
}

// --- Price matching logic ---

interface PriceRule {
  name: string;
  match: (productName: string, sku: string) => boolean;
  listPrice: number;
}

// Extract model number from SKU (e.g., "SG1011-C2" → 1011, "TA-1600-C1" → 1600)
function extractModelNumber(sku: string): number | null {
  // Try patterns like SG1011, LC9015, TA-1600, LU3001, etc.
  const match = sku.match(/[A-Z]{1,3}-?(\d{3,5})/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

function skuStartsWith(sku: string, prefix: string): boolean {
  // Normalize: "SG-1011-C2" and "SG1011-C2" should both match "SG"
  const normalized = sku.toUpperCase().replace(/-/g, "");
  const normalizedPrefix = prefix.toUpperCase().replace(/-/g, "");
  return normalized.startsWith(normalizedPrefix);
}

// Manomos per-model pricing
const MANOMOS_GLASSES_PRICES: Record<string, number> = {};
const manomosGlasses138 = ["Abbey", "Andy", "Bob", "Brian", "Cloud", "Crikets", "Dreamer", "Earth", "Elvis", "Galaxy", "George", "Grass", "Gravity", "Jackie", "Jimi", "John", "Lady", "Land", "Liverpool", "Love", "Martin", "Mary", "Mercury B", "Mercury", "Milky", "Mini", "Mods", "Music", "Olivia", "Once", "Ourora", "Piano", "Play", "Pop", "Ringo", "Road", "Runa", "Rush", "Sally", "Sunny", "Swan", "Thirteen", "Thirty six", "Todd"];
const manomosGlasses159 = ["Baby", "Button", "Cavern", "Coco", "Cosmos B", "Cosmos", "Pebble"];
const manomosGlasses176 = ["Gentleman"];
const manomosGlasses192 = ["Artist", "Bird", "Blue", "Jupiter"];
for (const m of manomosGlasses138) MANOMOS_GLASSES_PRICES[m.toLowerCase()] = 138.24;
for (const m of manomosGlasses159) MANOMOS_GLASSES_PRICES[m.toLowerCase()] = 159.50;
for (const m of manomosGlasses176) MANOMOS_GLASSES_PRICES[m.toLowerCase()] = 176.00;
for (const m of manomosGlasses192) MANOMOS_GLASSES_PRICES[m.toLowerCase()] = 192.50;

const MANOMOS_SUNGLASSES_PRICES: Record<string, number> = {};
const manomosSun138 = ["Cuty", "Lolita", "Love me do", "Michelle", "Nova", "Orion"];
const manomosSun159 = ["Astro", "Beast", "Billy", "Black", "Bossy", "City Pop", "Disco", "Harry", "Hey Jude", "House", "Jean", "Joy", "Lala", "Leon", "Let it be", "Mars", "Moon", "Rubber Soul", "Sing", "Sky", "Soul", "Stone", "Sun", "Tiffany", "Time", "Trap", "Twist", "Venus", "Yesterday"];
for (const m of manomosSun138) MANOMOS_SUNGLASSES_PRICES[m.toLowerCase()] = 138.24;
for (const m of manomosSun159) MANOMOS_SUNGLASSES_PRICES[m.toLowerCase()] = 159.50;

// Combined lookup for Manomos — check both glasses and sunglasses
const ALL_MANOMOS_PRICES: Record<string, number> = { ...MANOMOS_GLASSES_PRICES, ...MANOMOS_SUNGLASSES_PRICES };

function getManomosPrice(productName: string, sku: string): number | null {
  const name = productName.toLowerCase().trim();
  const skuLower = sku.toLowerCase().trim();

  // Exact SKU match (WooCommerce SKU is often just the model name like "Sky", "Leon")
  if (ALL_MANOMOS_PRICES[skuLower] !== undefined) return ALL_MANOMOS_PRICES[skuLower];

  // Exact product name match (name IS the model)
  if (ALL_MANOMOS_PRICES[name] !== undefined) return ALL_MANOMOS_PRICES[name];

  // "Manomos X" pattern — extract model name after "manomos "
  const manomosMatch = name.match(/^manomos\s+(.+?)(?:\s*\(|$)/i);
  if (manomosMatch) {
    const model = manomosMatch[1].toLowerCase().trim();
    if (ALL_MANOMOS_PRICES[model] !== undefined) return ALL_MANOMOS_PRICES[model];
  }

  // Product name contains "manomos" — try word boundary match
  if (name.includes("manomos")) {
    for (const [model, price] of Object.entries(ALL_MANOMOS_PRICES)) {
      const regex = new RegExp(`\\b${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(name)) return price;
    }
  }

  return null;
}

// Build price rules (order matters — more specific rules first)
const PRICE_RULES: PriceRule[] = [
  // 2026 New collections (must be before general SG/LC/LU rules)
  { name: "2026 New Signature (SG4041-4048)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "SG") && m !== null && m >= 4041 && m <= 4048; }, listPrice: 68 },
  { name: "2026 New London Titanium (LC9050-9055)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "LC") && m !== null && m >= 9050 && m <= 9055; }, listPrice: 99 },
  { name: "2026 New Urban Titanium (LU3001-3005)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "LU") && m !== null && m >= 3001 && m <= 3005; }, listPrice: 102 },

  // London sub-tiers
  { name: "London Titanium (LC9041-9045)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "LC") && m !== null && m >= 9041 && m <= 9045; }, listPrice: 97 },
  { name: "London Series (LC9015-9036)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "LC") && m !== null && m >= 9015 && m <= 9036; }, listPrice: 81 },

  // Tandy sub-tiers (most specific first)
  { name: "Tandy Titanium (1600,1601,1631-1638)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "TA") && m !== null && (m === 1600 || m === 1601 || (m >= 1631 && m <= 1638)); }, listPrice: 121 },
  { name: "Tandy Titanium (1144-1520)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "TA") && m !== null && m >= 1144 && m <= 1520; }, listPrice: 108 },
  { name: "Tandy (1610-1618, 7525, 7526)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "TA") && m !== null && ((m >= 1610 && m <= 1618) || m === 7525 || m === 7526); }, listPrice: 86 },
  { name: "Tandy (standard)", match: (_n, sku) => skuStartsWith(sku, "TA"), listPrice: 84 },

  // LL Titanium sub-tiers (before general LL)
  { name: "LL Titanium (L-5000)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "L") && !skuStartsWith(sku, "LL") && !skuStartsWith(sku, "LC") && !skuStartsWith(sku, "LU") && m !== null && m >= 5000 && m <= 5999; }, listPrice: 108 },
  { name: "LL Titanium (L-800, L-93)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "L") && !skuStartsWith(sku, "LL") && !skuStartsWith(sku, "LC") && !skuStartsWith(sku, "LU") && m !== null && ((m >= 800 && m <= 899) || (m >= 930 && m <= 939)); }, listPrice: 89 },

  // Classic Plus (LL3001+) before general Classic
  { name: "Classic Plus (LL3001+)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "LL") && m !== null && m >= 3001; }, listPrice: 63 },

  // Skylite sub-tiers
  { name: "Skylite (SL2008-2009)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "SL") && !skuStartsWith(sku, "SLEE") && m !== null && (m === 2008 || m === 2009); }, listPrice: 15 },
  { name: "Skylite (SL2001-2007)", match: (_n, sku) => { const m = extractModelNumber(sku); return skuStartsWith(sku, "SL") && !skuStartsWith(sku, "SLEE") && m !== null && m >= 2001 && m <= 2007; }, listPrice: 12 },

  // Simple prefix matches
  { name: "Eye Cloud", match: (_n, sku) => skuStartsWith(sku, "EK"), listPrice: 57 },
  { name: "Classic", match: (_n, sku) => skuStartsWith(sku, "LL"), listPrice: 65 },
  { name: "Junior", match: (_n, sku) => skuStartsWith(sku, "JN"), listPrice: 71 },
  { name: "Signature", match: (_n, sku) => skuStartsWith(sku, "SG"), listPrice: 76 },
  { name: "Signature +", match: (_n, sku) => skuStartsWith(sku, "SP"), listPrice: 81 },
  { name: "Milan", match: (_n, sku) => skuStartsWith(sku, "ML"), listPrice: 99 },
  { name: "Grand Collection", match: (_n, sku) => skuStartsWith(sku, "GC"), listPrice: 73 },
  { name: "Rimless Air", match: (_n, sku) => skuStartsWith(sku, "RA") || skuStartsWith(sku, "AIR"), listPrice: 68 },
  { name: "Urban", match: (_n, sku) => skuStartsWith(sku, "LU"), listPrice: 121 },
  { name: "Veritas", match: (_n, sku) => skuStartsWith(sku, "VT"), listPrice: 51 },
  { name: "SNF", match: (_n, sku) => skuStartsWith(sku, "SNF"), listPrice: 130 },
  { name: "TANI", match: (_n, sku) => skuStartsWith(sku, "T") && !skuStartsWith(sku, "TA"), listPrice: 59 },
  { name: "London (general)", match: (_n, sku) => skuStartsWith(sku, "LC"), listPrice: 81 },
  { name: "Skylite (general)", match: (_n, sku) => skuStartsWith(sku, "SL") && !skuStartsWith(sku, "SLEE"), listPrice: 12 },
];

// Discontinued brands — set to out of stock
const DISCONTINUED_BRANDS = ["clrotte", "dr. gram", "dr.gram"];

function isDiscontinued(productName: string): boolean {
  const lower = productName.toLowerCase();
  return DISCONTINUED_BRANDS.some((b) => lower.includes(b));
}

function isManomos(productName: string): boolean {
  return productName.toLowerCase().includes("manomos");
}

function findPrice(productName: string, sku: string, product?: WcProduct): { price: number; rule: string } | null {
  // Manomos: category-based detection + per-model pricing
  if (product && isManomosProduct(product)) {
    const isGlasses = isManomosGlasses(product);
    const lookup = isGlasses ? MANOMOS_GLASSES_PRICES : MANOMOS_SUNGLASSES_PRICES;
    const name = productName.toLowerCase().trim();

    // Try exact name match
    for (const [model, price] of Object.entries(lookup)) {
      if (name === model || name.startsWith(model + " ") || name.includes(`manomos ${model}`)) {
        return { price, rule: `Manomos ${isGlasses ? "Glasses" : "Sunglasses"} (${model})` };
      }
    }

    // Fallback: try matching any word in the name against model list
    const words = name.replace(/[()]/g, "").split(/\s+/);
    for (const word of words) {
      if (lookup[word] !== undefined) {
        return { price: lookup[word], rule: `Manomos ${isGlasses ? "Glasses" : "Sunglasses"} (${word})` };
      }
    }

    // Try combined list as last resort
    for (const [model, price] of Object.entries(ALL_MANOMOS_PRICES)) {
      if (name === model || name.startsWith(model + " ")) {
        return { price, rule: `Manomos (${model})` };
      }
    }

    // Manomos product but couldn't determine specific model price
    return null;
  }

  // Non-category Manomos: try SKU/name match (for products not properly categorized)
  const manomosPrice = getManomosPrice(productName, sku);
  if (manomosPrice !== null) return { price: manomosPrice, rule: `Manomos (${productName})` };

  // TANI products without SKU — match by product name starting with "T-" or "T "
  if (!sku && /^T[-\s]?\d{4}/i.test(productName)) {
    return { price: 59, rule: "TANI (name match)" };
  }

  // Products with no SKU — match by name
  if (!sku) {
    if (/^ML\d{4}/i.test(productName)) return { price: 99, rule: "Milan (name match)" };
    if (/^LL-\d{3}/i.test(productName)) return { price: 89, rule: "LL Titanium (name match)" };
  }

  // SKU-based rules
  for (const rule of PRICE_RULES) {
    if (rule.match(productName, sku)) {
      return { price: rule.listPrice, rule: rule.name };
    }
  }

  return null;
}

// --- Main ---
interface UpdateLog {
  id: number;
  name: string;
  sku: string;
  rule: string;
  oldPrice: string;
  newPrice: string;
  type: "price" | "discontinued";
}

async function main(): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  2026 WOOCOMMERCE PRICE UPDATE${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("Fetching all products from WooCommerce...");
  const products = await wcGetAll<WcProduct>("/products", { status: "any" });
  console.log(`Found ${products.length} products.\n`);

  const updated: UpdateLog[] = [];
  const discontinued: UpdateLog[] = [];
  const skipped: { id: number; name: string; sku: string; reason: string }[] = [];

  for (const product of products) {
    // Check discontinued
    if (isDiscontinued(product.name)) {
      discontinued.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        rule: "Discontinued",
        oldPrice: product.regular_price,
        newPrice: "0",
        type: "discontinued",
      });

      if (!DRY_RUN) {
        // Set parent to out of stock
        await wcPut(`/products/${product.id}`, { stock_status: "outofstock", manage_stock: true, stock_quantity: 0 });
        await delay(API_DELAY_MS);
        // Set all variations to out of stock
        if (product.type === "variable") {
          const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);
          for (const v of variations) {
            if (v.stock_status !== "outofstock") {
              await wcPut(`/products/${product.id}/variations/${v.id}`, { stock_status: "outofstock", manage_stock: true, stock_quantity: 0 });
              await delay(API_DELAY_MS);
            }
          }
        }
        console.log(`  ❌ ${product.name} → OUT OF STOCK (discontinued)`);
      } else {
        console.log(`  [DRY] ❌ ${product.name} → would set OUT OF STOCK`);
      }
      continue;
    }

    // Find the right price
    const sku = product.sku || "";
    const result = findPrice(product.name, sku, product);

    if (!result) {
      skipped.push({ id: product.id, name: product.name, sku, reason: "No matching price rule" });
      continue;
    }

    const newPrice = result.price.toFixed(2);
    const oldPrice = product.regular_price || "0.00";

    // Skip if price already matches
    if (parseFloat(oldPrice) === result.price) {
      continue;
    }

    updated.push({
      id: product.id,
      name: product.name,
      sku,
      rule: result.rule,
      oldPrice,
      newPrice,
      type: "price",
    });

    if (!DRY_RUN) {
      // Update parent product price
      await wcPut(`/products/${product.id}`, { regular_price: newPrice });
      await delay(API_DELAY_MS);

      // Update all variation prices too
      if (product.type === "variable") {
        const variations = await wcGetAll<WcVariation>(`/products/${product.id}/variations`);
        for (const v of variations) {
          if (v.regular_price !== newPrice) {
            await wcPut(`/products/${product.id}/variations/${v.id}`, { regular_price: newPrice });
            await delay(API_DELAY_MS);
          }
        }
      }
      console.log(`  ✅ ${product.name} (${sku}): $${oldPrice} → $${newPrice} [${result.rule}]`);
    } else {
      console.log(`  [DRY] ✅ ${product.name} (${sku}): $${oldPrice} → $${newPrice} [${result.rule}]`);
    }
  }

  // --- Summary ---
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SUMMARY${DRY_RUN ? " (DRY RUN — no changes made)" : ""}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Products scanned:   ${products.length}`);
  console.log(`  Prices updated:     ${updated.length}`);
  console.log(`  Discontinued (OOS): ${discontinued.length}`);
  console.log(`  Skipped:            ${skipped.length}`);
  console.log(`  Already correct:    ${products.length - updated.length - discontinued.length - skipped.length}`);

  if (skipped.length > 0) {
    console.log(`\n  SKIPPED PRODUCTS (no matching price rule):`);
    for (const s of skipped) {
      console.log(`    - ${s.name} (SKU: ${s.sku || "none"}) — ${s.reason}`);
    }
  }

  if (DRY_RUN && (updated.length > 0 || discontinued.length > 0)) {
    console.log(`\n  Run without --dry-run to apply changes.`);
  }

  console.log("");
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
