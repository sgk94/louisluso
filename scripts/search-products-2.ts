import "dotenv/config";
import { z } from "zod";

const env = z.object({
  WC_CONSUMER_KEY: z.string().startsWith("ck_"),
  WC_CONSUMER_SECRET: z.string().startsWith("cs_"),
  WC_STORE_URL: z.string().url(),
}).parse(process.env);

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL("/wp-json/wc/v3" + path, env.WC_STORE_URL);
  url.searchParams.set("consumer_key", env.WC_CONSUMER_KEY);
  url.searchParams.set("consumer_secret", env.WC_CONSUMER_SECRET);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function getVariants(productId: number): Promise<void> {
  const url = buildUrl(`/products/${productId}/variations`, { per_page: "100" });
  const res = await fetch(url);
  const variants = (await res.json()) as { id: number; sku: string; attributes: { name: string; option: string }[] }[];
  for (const v of variants) {
    const color = v.attributes.map((a) => a.option).join(", ");
    console.log(`    variant id:${v.id} sku:"${v.sku}" color:"${color}"`);
  }
  await new Promise((r) => setTimeout(r, 800));
}

async function search(term: string): Promise<number[]> {
  const url = buildUrl("/products", { search: term, per_page: "10" });
  const res = await fetch(url);
  const products = (await res.json()) as { id: number; name: string; sku: string; variations: number[] }[];
  const ids: number[] = [];
  for (const p of products) {
    console.log(`  "${term}" → id:${p.id} name:"${p.name}" sku:"${p.sku}" variants:${p.variations.length}`);
    ids.push(p.id);
  }
  if (products.length === 0) console.log(`  "${term}" → no results`);
  await new Promise((r) => setTimeout(r, 800));
  return ids;
}

async function main(): Promise<void> {
  // Check T-7223 variant SKU format
  console.log("--- T-7223 variants ---");
  await getVariants(26871);

  // Check T-7241 variants
  console.log("\n--- T-7241 variants ---");
  await getVariants(27099);

  // Check LL4004 variants
  console.log("\n--- LL4004 (id:8846) variants ---");
  await getVariants(8846);

  // Search for SG-40xx with different patterns
  console.log("\n--- SG-40xx searches ---");
  await search("SG4041");
  await search("SG 4041");
  await search("40");

  // Try searching all products with SG in the name
  console.log("\n--- All SG products ---");
  const url = buildUrl("/products", { search: "SG", per_page: "100" });
  const res = await fetch(url);
  const products = (await res.json()) as { id: number; name: string; sku: string }[];
  const sg40 = products.filter((p) => p.name.includes("40") || p.sku.includes("40"));
  if (sg40.length > 0) {
    for (const p of sg40) {
      console.log(`  id:${p.id} name:"${p.name}" sku:"${p.sku}"`);
    }
  } else {
    console.log("  No SG products with '40' in name/sku");
    console.log("  All SG products found:");
    for (const p of products.slice(0, 30)) {
      console.log(`    id:${p.id} name:"${p.name}" sku:"${p.sku}"`);
    }
  }
}

main().catch(console.error);
