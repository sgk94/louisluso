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

// --- Restock list from TANI Reorder Lists (26.3.25) ---
// ONLY entries confirmed via SKU match — no guesses

interface RestockEntry {
  productId: number;
  variantId: number;
  model: string;
  color: string;
  qty: number;
}

const RESTOCK: RestockEntry[] = [
  // --- TANI (SKU-confirmed) ---
  // T-7223: SKU "T 7223 CO1", "T 7223 CO2"
  { productId: 26871, variantId: 27035, model: "T-7223", color: "C1 Brown", qty: 10 },
  { productId: 26871, variantId: 27036, model: "T-7223", color: "C2 Grey", qty: 10 },
  // T-7224: SKU "T 7224 COL 1", "T7224_col6", "T7224_col8"
  { productId: 26853, variantId: 27043, model: "T-7224", color: "C1 Brown", qty: 10 },
  { productId: 26853, variantId: 26859, model: "T-7224", color: "C6 Wine", qty: 10 },
  { productId: 26853, variantId: 26861, model: "T-7224", color: "C8 Grey", qty: 10 },
  // T-7235: SKU "T7235 CO 2"
  { productId: 26842, variantId: 26843, model: "T-7235", color: "C2 Grey", qty: 10 },
  // T-7236: SKU "T-7236 CO8 TRANSPARENT"
  { productId: 27059, variantId: 27065, model: "T-7236", color: "C8 Transparent", qty: 10 },
  // T-7247: SKU "T-7247/6... COL 6 Purple"
  { productId: 26925, variantId: 26934, model: "T-7247", color: "C6 Purple", qty: 10 },
  // T-7248: SKU "T-7248... COL 18 Pink"
  { productId: 26936, variantId: 26941, model: "T-7248", color: "C18 Pink", qty: 10 },

  // --- Signature Series (SKU-confirmed) ---
  { productId: 8377, variantId: 8385, model: "SG1013", color: "C6 Purple Glossed", qty: 10 },
  { productId: 8529, variantId: 14171, model: "SG1015", color: "C6 Purple", qty: 10 },
  { productId: 9129, variantId: 10856, model: "SG1032", color: "C1 Black Glossed", qty: 10 },
  { productId: 9129, variantId: 10857, model: "SG1032", color: "C3 Brown Glossed", qty: 12 },
  { productId: 9135, variantId: 10866, model: "SG1033", color: "C4 Wine Glossed", qty: 3 },
  { productId: 9135, variantId: 10864, model: "SG1033", color: "C7 Blue Glossed", qty: 10 },
  { productId: 11018, variantId: 11020, model: "SG1035", color: "C3 Brown Glossed", qty: 10 },
  { productId: 11018, variantId: 11022, model: "SG1035", color: "C6 Purple Glossed", qty: 10 },
  { productId: 11031, variantId: 11035, model: "SG1036", color: "C7 Blue Glossed", qty: 10 },
  { productId: 11037, variantId: 11039, model: "SG1037", color: "C3 Brown Glossed", qty: 10 },
  { productId: 11037, variantId: 11041, model: "SG1037", color: "C7 Blue Glossed", qty: 10 },

  // --- LL4004 (confirmed L-4004) ---
  { productId: 8846, variantId: 8847, model: "LL4004", color: "C1 Black Matte", qty: 20 },
];

// STILL NEED VERIFICATION (color-to-number mapping uncertain, no SKU):
const NEEDS_VERIFY = [
  "T-7224 C5 (qty 10) — no C5 in variant SKUs, which color is C5?",
  "T-7235 C11 (qty 10) — no CO11 in SKUs, which color is C11?",
  "T-7238 C2 (qty 10) — no SKUs on any variants",
  "T-7238 C8 (qty 10) — no SKUs on any variants",
  "T-7239 C1 (qty 10) — no SKUs on any variants",
  "T-7241 C2 (qty 10) — no SKUs on any variants",
  "T-7241 C3 (qty 10) — no SKUs on any variants",
  "T-7241 C8 (qty 10) — no SKUs on any variants",
  "T-7249 C3 (qty 10) — no SKUs on any variants",
  "T-7249 C11 (qty 10) — no SKUs on any variants",
  "T-7251 C2DG (qty 10) — no SKUs, likely Dark Grey but unconfirmed",
];

// NOT IN WOOCOMMERCE:
const NOT_FOUND = [
  "T-7242 C18 (qty 10)",
  "T-7242 C2 (qty 10)",
  "SG-4041 C6 (qty 10)",
  "SG-4042 C26 (qty 10)",
  "SG-4044 C7 (qty 10)",
  "SG-4046 C2 (qty 10)",
  "SG-4047 C1 (qty 10)",
  "SG-4048 C7 (qty 10)",
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

// --- Main ---
async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");

  if (DRY_RUN) {
    console.log("*** DRY RUN — no changes will be made ***\n");
  }

  const totalUnits = RESTOCK.reduce((sum, e) => sum + e.qty, 0);

  console.log("Restock Script — 2026-03-25 (TANI Reorder Lists)");
  console.log(`Store: ${env.WC_STORE_URL}`);
  console.log(`Confirmed variants to update: ${RESTOCK.length}`);
  console.log(`Total units (confirmed): ${totalUnits}\n`);

  if (NEEDS_VERIFY.length > 0) {
    console.log("⚠️  NEEDS VERIFICATION (skipped — no SKU to confirm color):");
    for (const item of NEEDS_VERIFY) {
      console.log(`  - ${item}`);
    }
    console.log();
  }

  if (NOT_FOUND.length > 0) {
    console.log("❌ NOT IN WOOCOMMERCE (skipped — products don't exist):");
    for (const item of NOT_FOUND) {
      console.log(`  - ${item}`);
    }
    console.log();
  }

  console.log("--- Updating confirmed variants ---\n");

  let updated = 0;
  let failed = 0;
  const parentIds = new Set<number>();

  for (const entry of RESTOCK) {
    const label = `${entry.model} ${entry.color} (product:${entry.productId}, variant:${entry.variantId})`;
    console.log(`${label} — qty: ${entry.qty}`);

    if (!DRY_RUN) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        await wcPut(`/products/${entry.productId}/variations/${entry.variantId}`, {
          stock_status: "instock",
          manage_stock: true,
          stock_quantity: entry.qty,
        });
        console.log(`  ✓ Set to instock, qty=${entry.qty}`);
        updated++;
        parentIds.add(entry.productId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed: ${msg}`);
        failed++;
      }
    } else {
      console.log(`  (dry run — would set to instock, qty=${entry.qty})`);
      updated++;
      parentIds.add(entry.productId);
    }
  }

  // Enable manage_stock on parent products
  console.log("\n--- Enabling manage_stock on parent products ---\n");
  for (const productId of parentIds) {
    if (!DRY_RUN) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        await wcPut(`/products/${productId}`, {
          manage_stock: true,
          stock_quantity: 20,
        });
        console.log(`  ✓ Product ${productId} — manage_stock enabled`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Product ${productId} — failed: ${msg}`);
      }
    } else {
      console.log(`  (dry run — would enable manage_stock on product ${productId})`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Updated:        ${updated} variants`);
  console.log(`Failed:         ${failed}`);
  console.log(`Skipped (verify): ${NEEDS_VERIFY.length} items`);
  console.log(`Skipped (no WC):  ${NOT_FOUND.length} items`);

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
