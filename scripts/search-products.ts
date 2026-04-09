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

async function search(term: string): Promise<void> {
  const url = buildUrl("/products", { search: term, per_page: "5" });
  const res = await fetch(url);
  const products = (await res.json()) as { id: number; name: string; sku: string }[];
  if (products.length > 0) {
    for (const p of products) {
      console.log(`  "${term}" → id:${p.id} name:"${p.name}" sku:"${p.sku}"`);
    }
  } else {
    console.log(`  "${term}" → no results`);
  }
  await new Promise((r) => setTimeout(r, 800));
}

async function main(): Promise<void> {
  console.log("--- T-series searches ---");
  await search("T-7223");
  await search("7223");
  await search("T-7241");
  await search("7241");

  console.log("\n--- SG-40xx searches ---");
  await search("SG-4041");
  await search("4041");
  await search("SG-4042");
  await search("4042");

  console.log("\n--- L-4004 searches ---");
  await search("L-4004");
  await search("4004");
  await search("L4004");

  console.log("\n--- Broader searches ---");
  await search("TANI");
  await search("London");
}

main().catch(console.error);
