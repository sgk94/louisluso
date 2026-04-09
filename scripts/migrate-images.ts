// scripts/migrate-images.ts
// Downloads product images from WooCommerce and uploads to Cloudinary.
// READ-ONLY on WooCommerce — no writes, no deletions.
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // also load .env for WC creds

import { v2 as cloudinary } from "cloudinary";
import { getItemGroups } from "../lib/zoho/inventory";
import { matchCollection } from "../lib/catalog/collections";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.argv.includes("--dry-run");

const WC_URL = process.env.WC_STORE_URL!;
const WC_KEY = process.env.WC_CONSUMER_KEY!;
const WC_SECRET = process.env.WC_CONSUMER_SECRET!;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface WcProduct {
  id: number;
  name: string;
  sku: string;
  type: string;
  images: Array<{ id: number; src: string; name: string; alt: string }>;
  variations: number[];
  categories: Array<{ slug: string; name: string }>;
}

interface WcVariation {
  id: number;
  sku: string;
  image: { id: number; src: string; name: string; alt: string } | null;
  attributes: Array<{ name: string; option: string }>;
}

interface UploadResult {
  product: string;
  type: "main" | "variant";
  color?: string;
  publicId: string;
  url: string;
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

function normalize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

// Clean up a product name/SKU for use as Cloudinary folder name
function toPublicId(productName: string, suffix: string): string {
  const clean = productName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `products/${clean}/${suffix}`;
}

async function uploadToCloudinary(
  imageUrl: string,
  publicId: string,
): Promise<string> {
  const result = await cloudinary.uploader.upload(imageUrl, {
    public_id: publicId,
    overwrite: false, // Don't overwrite existing images
    resource_type: "image",
    format: "jpg",
    transformation: [
      { quality: "auto", fetch_format: "auto" },
    ],
  });
  return result.secure_url;
}

async function main(): Promise<void> {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Step 1: Build Zoho lookup for matching
  console.log("Fetching Zoho item groups...");
  const zohoGroups = await getItemGroups();
  const zohoNormMap = new Map<string, string>();
  for (const g of zohoGroups) {
    const col = matchCollection(g);
    if (!col) continue;
    zohoNormMap.set(normalize(g.group_name), g.group_name);
    const numMatch = g.group_name.match(/(\d{3,})/);
    if (numMatch) zohoNormMap.set(numMatch[1], g.group_name);
    // Titanium matching
    const taMatch = g.group_name.match(/^TA\(T\)-(\d+)/);
    if (taMatch) zohoNormMap.set("TA" + taMatch[1], g.group_name);
    const llMatch = g.group_name.match(/^LL\(T\)-(\d+)/);
    if (llMatch) zohoNormMap.set("T" + llMatch[1], g.group_name);
  }
  console.log(`Zoho matched products: ${zohoNormMap.size} entries\n`);

  // Step 2: Fetch all WC products
  console.log("Fetching WooCommerce products...");
  const allWc: WcProduct[] = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await wcFetch<WcProduct[]>("/products", {
      per_page: "100",
      page: String(page),
      status: "publish",
    });
    if (!batch.length) break;
    allWc.push(...batch);
  }
  console.log(`WC products: ${allWc.length}\n`);

  // Exclude discontinued categories
  const excludeCats = new Set(["clrotte-glasses", "dr-gram"]);
  const wcProducts = allWc.filter(
    (p) =>
      !p.categories?.some((c) => excludeCats.has(c.slug)) &&
      p.name !== "Auto-Pay 5% Off",
  );

  const results: UploadResult[] = [];
  const errors: Array<{ product: string; error: string }> = [];
  let uploaded = 0;
  let skippedNoMatch = 0;
  let skippedNoImage = 0;

  for (const product of wcProducts) {
    // Match to Zoho
    const normName = normalize(product.name);
    const normSku = normalize(product.sku || product.name);
    const zohoName =
      zohoNormMap.get(normName) ?? zohoNormMap.get(normSku) ?? null;

    if (!zohoName) {
      skippedNoMatch++;
      continue;
    }

    // Upload main product image
    if (product.images?.length > 0) {
      const mainImg = product.images[0];
      const publicId = toPublicId(zohoName, "main");

      console.log(
        `${zohoName}: main image → ${publicId}`,
      );

      if (!DRY_RUN) {
        try {
          const url = await uploadToCloudinary(mainImg.src, publicId);
          results.push({
            product: zohoName,
            type: "main",
            publicId,
            url,
          });
          uploaded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("already exists")) {
            console.log(`  ⊘ Already exists, skipping`);
          } else {
            console.log(`  ✗ Error: ${msg}`);
            errors.push({ product: zohoName, error: msg });
          }
        }
      } else {
        uploaded++;
      }

      // Upload additional product images
      for (let i = 1; i < product.images.length; i++) {
        const img = product.images[i];
        const imgPublicId = toPublicId(zohoName, `view-${i}`);
        console.log(`  + view-${i} → ${imgPublicId}`);

        if (!DRY_RUN) {
          try {
            const url = await uploadToCloudinary(img.src, imgPublicId);
            results.push({
              product: zohoName,
              type: "main",
              publicId: imgPublicId,
              url,
            });
            uploaded++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("already exists")) {
              errors.push({ product: `${zohoName}/view-${i}`, error: msg });
            }
          }
        } else {
          uploaded++;
        }
      }
    } else {
      skippedNoImage++;
    }

    // Upload variant images
    if (product.type === "variable" && product.variations?.length > 0) {
      const variations = await wcFetch<WcVariation[]>(
        `/products/${product.id}/variations`,
        { per_page: "50" },
      );

      for (const variant of variations) {
        if (!variant.image?.src) continue;

        // Skip if variant image is same as main
        if (
          product.images?.[0]?.src &&
          variant.image.src === product.images[0].src
        )
          continue;

        const color =
          variant.attributes?.find((a) => a.name === "Color")?.option ?? "";
        const colorSlug = color
          ? color
              .replace(/[^a-zA-Z0-9]/g, "-")
              .replace(/-+/g, "-")
              .toLowerCase()
          : variant.sku || `variant-${variant.id}`;
        const varPublicId = toPublicId(zohoName, colorSlug);

        console.log(`  + ${color || variant.sku} → ${varPublicId}`);

        if (!DRY_RUN) {
          try {
            const url = await uploadToCloudinary(variant.image.src, varPublicId);
            results.push({
              product: zohoName,
              type: "variant",
              color,
              publicId: varPublicId,
              url,
            });
            uploaded++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("already exists")) {
              errors.push({ product: `${zohoName}/${colorSlug}`, error: msg });
            }
          }
        } else {
          uploaded++;
        }
      }
    }

    // Small delay between products to avoid rate limits
    if (!DRY_RUN) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Uploaded: ${uploaded}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Skipped (no Zoho match): ${skippedNoMatch}`);
  console.log(`Skipped (no image): ${skippedNoImage}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(`  ${e.product}: ${e.error}`));
  }

  // Save report
  const reportPath = path.join(
    __dirname,
    "data",
    "image-migration-report.json",
  );
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { uploaded, skippedNoMatch, skippedNoImage, errors, results },
      null,
      2,
    ),
  );
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch(console.error);
