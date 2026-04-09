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

async function searchProduct(term: string): Promise<{ id: number; name: string; sku: string } | null> {
  const url = buildUrl("/products", { search: term, per_page: "5" });
  const res = await fetch(url);
  const products = (await res.json()) as { id: number; name: string; sku: string }[];
  const match = products.find((p) => p.name.includes(term) || p.sku.includes(term.replace("-", "")));
  await new Promise((r) => setTimeout(r, 500));
  return match || null;
}

async function getVariants(productId: number): Promise<{ id: number; sku: string; color: string }[]> {
  const url = buildUrl(`/products/${productId}/variations`, { per_page: "100" });
  const res = await fetch(url);
  const variants = (await res.json()) as { id: number; sku: string; attributes: { name: string; option: string }[] }[];
  await new Promise((r) => setTimeout(r, 500));
  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.attributes.map((a) => a.option).join(", "),
  }));
}

const tModels = ["T-7223", "T-7224", "T-7235", "T-7236", "T-7238", "T-7239", "T-7241", "T-7242", "T-7247", "T-7248", "T-7249", "T-7251"];

async function main(): Promise<void> {
  for (const model of tModels) {
    const product = await searchProduct(model);
    if (!product) {
      console.log(`${model}: NOT FOUND`);
      continue;
    }
    console.log(`${model}: id:${product.id} name:"${product.name}" sku:"${product.sku}"`);
    const variants = await getVariants(product.id);
    for (const v of variants) {
      console.log(`    id:${v.id} sku:"${v.sku}" color:"${v.color}"`);
    }
    console.log();
  }
}

main().catch(console.error);
