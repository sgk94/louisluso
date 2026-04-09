// scripts/sync-wc-to-zoho.ts
// Creates missing WooCommerce products in Zoho Inventory.
// Read-only on WooCommerce side — only creates in Zoho.
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // also load .env for WC creds

import { getItemGroups } from "../lib/zoho/inventory";
import { getAccessToken } from "../lib/zoho/auth";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const ZOHO_API_BASE =
  process.env.ZOHO_API_BASE_URL ?? "https://www.zohoapis.com";
const ORG_ID = process.env.ZOHO_ORG_ID!;
const WC_URL = process.env.WC_STORE_URL!;
const WC_KEY = process.env.WC_CONSUMER_KEY!;
const WC_SECRET = process.env.WC_CONSUMER_SECRET!;

// Rate by collection slug (from 2026 price sheet)
const RATES: Record<string, number> = {
  "milan-series": 99,
  "veritas-classic": 51,
  tani: 0, // TBD — owner will set later
  "manomos-glasses": 0, // TBD
  "manomos-sunglasses": 0, // TBD
};

// Brand by collection slug
const BRANDS: Record<string, string> = {
  "milan-series": "LOUISLUSO",
  "veritas-classic": "VERITAS",
  tani: "TANI",
  "manomos-glasses": "MANOMOS",
  "manomos-sunglasses": "MANOMOS",
};

// WC category slugs to sync
const TARGET_CATEGORIES = [
  "tani",
  "milan-series",
  "veritas-classic",
  "manomos-glasses",
  "manomos-sunglasses",
];

// Excluded WC product names (not real products)
const EXCLUDED_NAMES = ["Auto-Pay 5% Off"];

interface WcProduct {
  id: number;
  name: string;
  sku: string;
  type: string;
  categories: Array<{ slug: string; name: string }>;
  variations: number[];
  attributes: Array<{ name: string; options: string[] }>;
}

interface WcVariation {
  id: number;
  sku: string;
  attributes: Array<{ name: string; option: string }>;
}

async function wcFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  const u = new URL(WC_URL + "/wp-json/wc/v3" + endpoint);
  u.searchParams.set("consumer_key", WC_KEY);
  u.searchParams.set("consumer_secret", WC_SECRET);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`WC API error: ${r.status}`);
  return r.json() as Promise<T>;
}

async function zohoPost(
  apiPath: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}${apiPath}?organization_id=${ORG_ID}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<Record<string, unknown>>;
}

function normalize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

async function main(): Promise<void> {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Step 1: Build Zoho lookup
  console.log("Fetching Zoho item groups...");
  const zohoGroups = await getItemGroups();
  const zohoNormSet = new Set<string>();
  for (const g of zohoGroups) {
    zohoNormSet.add(normalize(g.group_name));
    // Also add numeric-only variant for titanium matching
    const numMatch = g.group_name.match(/(\d{3,})/);
    if (numMatch) zohoNormSet.add(numMatch[1]);
  }
  console.log(`Zoho groups: ${zohoGroups.length}\n`);

  // Step 2: Get WC categories
  const wcCats = await wcFetch<
    Array<{ id: number; slug: string; name: string }>
  >("/products/categories", { per_page: "100" });

  let totalCreated = 0;
  let totalSkipped = 0;
  const created: Array<{ name: string; collection: string; variants: number }> =
    [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const catSlug of TARGET_CATEGORIES) {
    const cat = wcCats.find((c) => c.slug === catSlug);
    if (!cat) {
      console.log(`Category "${catSlug}" not found in WC, skipping.`);
      continue;
    }

    const rate = RATES[catSlug] ?? 0;
    const brand = BRANDS[catSlug] ?? "";

    // Fetch all published products in this category
    const products: WcProduct[] = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await wcFetch<WcProduct[]>("/products", {
        category: String(cat.id),
        per_page: "100",
        page: String(page),
        status: "publish",
      });
      if (!batch.length) break;
      products.push(...batch);
    }

    console.log(
      `=== ${cat.name} (${products.length} products, brand: ${brand}, rate: $${rate}) ===`,
    );

    for (const product of products) {
      // Skip non-products
      if (EXCLUDED_NAMES.includes(product.name)) {
        skipped.push({ name: product.name, reason: "excluded name" });
        continue;
      }

      // Check if already in Zoho
      const normName = normalize(product.name);
      const normSku = normalize(product.sku || product.name);
      if (zohoNormSet.has(normName) || zohoNormSet.has(normSku)) {
        skipped.push({ name: product.name, reason: "already in Zoho" });
        totalSkipped++;
        continue;
      }

      // Fetch variations
      let variations: WcVariation[] = [];
      if (product.type === "variable" && product.variations?.length) {
        variations = await wcFetch<WcVariation[]>(
          `/products/${product.id}/variations`,
          { per_page: "50" },
        );
      }

      // Build Zoho item group name (use product name, cleaned up)
      const groupName = product.name.replace(/\s*\(.*\)$/, "").trim(); // Remove "(BTS V)" suffixes

      // Build variant items
      const items = variations.map((v) => {
        const color =
          v.attributes?.find((a) => a.name === "Color")?.option ?? "";
        const variantName = color
          ? `${groupName} ${color}`
          : `${groupName} ${v.sku || ""}`.trim();

        return {
          name: variantName,
          rate,
          sku: v.sku || `${groupName}-${color}`,
        };
      });

      // If no variations, create single item
      if (items.length === 0) {
        items.push({
          name: groupName,
          rate,
          sku: product.sku || groupName,
        });
      }

      console.log(
        `  CREATE: ${groupName} [${brand}] — ${items.length} variant(s) @ $${rate}`,
      );
      items.forEach((item) => console.log(`    → ${item.name} (${item.sku})`));

      if (!DRY_RUN) {
        const result = await zohoPost("/inventory/v1/itemgroups", {
          group_name: groupName,
          brand,
          unit: "pcs",
          items,
        });

        if ((result as { code?: number }).code === 0) {
          console.log(`    ✓ Created in Zoho`);
        } else {
          console.log(
            `    ✗ Error: ${JSON.stringify(result)}`,
          );
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      created.push({
        name: groupName,
        collection: cat.name,
        variants: items.length,
      });
      zohoNormSet.add(normalize(groupName)); // Prevent duplicate creation
      totalCreated++;
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Created: ${totalCreated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Skipped (already in Zoho): ${totalSkipped}`);

  if (created.length > 0) {
    console.log("\nCreated products:");
    created.forEach((c) =>
      console.log(`  ${c.name} [${c.collection}] — ${c.variants} variants`),
    );
  }

  // Save report
  const reportPath = path.join(
    __dirname,
    "data",
    "wc-zoho-sync-report.json",
  );
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ created, skipped, totalCreated, totalSkipped }, null, 2),
  );
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch(console.error);
