import "dotenv/config";

const VARIANT_IDS = new Set([
  27131, 8268, 8267, 8489, 8486, 8503, 8497,
  8363, 8347, 8410, 8408, 8446, 8445, 8444, 8454, 8466, 14265, 14270,
  11044, 8229, 8228, 8227, 8226, 8237, 8236, 8235, 8234, 8233, 8232, 8231,
  8251, 8250, 8247, 8246, 8245, 8243, 8242, 8829, 8843, 8842,
  16772, 16782, 16796, 16792,
  8856, 8855, 8854, 8852, 8851, 8850, 8848, 8860, 11789, 8898,
]);

const base = process.env.WC_STORE_URL!;
const ck = process.env.WC_CONSUMER_KEY!;
const cs = process.env.WC_CONSUMER_SECRET!;

async function get(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL("/wp-json/wc/v3" + path, base);
  url.searchParams.set("consumer_key", ck);
  url.searchParams.set("consumer_secret", cs);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + " " + r.statusText);
  return r.json();
}

async function getAll(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const batch = (await get(path, { ...params, per_page: "100", page: String(page) })) as Record<string, unknown>[];
    results.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return results;
}

async function main(): Promise<void> {
  const cats = await getAll("/products/categories");
  const catIds = cats
    .filter((c) => ["junior-series", "london-collection"].includes(c.slug as string) || (c.slug === "classic" && c.name === "Classic"))
    .map((c) => c.id as number);

  const seen = new Set<number>();
  const products: Record<string, unknown>[] = [];
  for (const catId of catIds) {
    await new Promise((r) => setTimeout(r, 500));
    const ps = await getAll("/products", { category: String(catId) });
    for (const p of ps) {
      if (!seen.has(p.id as number)) {
        seen.add(p.id as number);
        products.push(p);
      }
    }
  }

  let managed = 0;
  let unmanaged = 0;

  for (const p of products.sort((a, b) => (a.name as string).localeCompare(b.name as string))) {
    if (!((p.variations as number[]).length > 0)) continue;
    await new Promise((r) => setTimeout(r, 500));
    const vars = await getAll("/products/" + p.id + "/variations");
    for (const v of vars) {
      if (!VARIANT_IDS.has(v.id as number)) continue;
      const color = (v.attributes as { option: string }[]).map((a) => a.option).join(", ");
      console.log(
        `${p.name} — ${color} (${v.id}): manage_stock=${v.manage_stock}, stock_status=${v.stock_status}, qty=${v.stock_quantity}`
      );
      if (v.manage_stock) managed++;
      else unmanaged++;
    }
  }

  console.log("\n--- TOTALS ---");
  console.log("manage_stock=true:", managed);
  console.log("manage_stock=false:", unmanaged);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
