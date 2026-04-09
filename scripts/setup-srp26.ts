// scripts/setup-srp26.ts
import "dotenv/config";
import { getItemGroups, getPriceBooks } from "../lib/zoho/inventory";
import { getAccessToken } from "../lib/zoho/auth";
import { matchCollection } from "../lib/catalog/collections";
import type { Collection } from "../lib/catalog/collections";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const ZOHO_API_BASE = process.env.ZOHO_API_BASE_URL ?? "https://www.zohoapis.com";
const ORG_ID = process.env.ZOHO_ORG_ID!;

// 2026 list prices by collection slug
const LIST_PRICES_2026: Record<string, number> = {
  "signature-series": 76,
  "signature-plus-series": 81,
  "london-collection": 81,
  "urban-collection": 121,
  "milan-series": 99,
  "classic": 65,
  "louisluso-titanium": 108,
  "grand-collection": 73,
  "rimless-air-series": 68,
  "skylite": 12,
  "snf": 130,
  "eyes-cloud-kids": 57,
  "tandy-series": 84,
  "tandy-titanium": 108,
  "veritas-classic": 51,
  "veritas-series": 51,
};

// 2026 SRP prices by collection slug
const SRP_2026: Record<string, number> = {
  "signature-series": 227,
  "signature-plus-series": 243,
  "london-collection": 243,
  "urban-collection": 362,
  "milan-series": 296,
  "classic": 195,
  "louisluso-titanium": 267,
  "grand-collection": 218,
  "rimless-air-series": 203,
  "skylite": 36,
  "snf": 390,
  "eyes-cloud-kids": 170,
  "tandy-series": 253,
  "tandy-titanium": 324,
  "veritas-classic": 154,
  "veritas-series": 154,
};

async function zohoPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}${path}?organization_id=${ORG_ID}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function zohoPut(apiPath: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}${apiPath}?organization_id=${ORG_ID}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function main(): Promise<void> {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Step 1: Fetch all item groups
  console.log("Fetching all item groups from Zoho...");
  const groups = await getItemGroups();
  console.log(`Found ${groups.length} item groups.\n`);

  // Step 2: Backup current rates
  const backupData = groups.flatMap((g) =>
    (g.items ?? []).map((item) => ({
      group_id: g.group_id,
      group_name: g.group_name,
      item_id: item.item_id,
      name: item.name,
      sku: item.sku,
      rate: item.rate,
    })),
  );

  const backupDir = path.join(__dirname, "data");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "zoho-rates-backup-2026-04-09.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backed up ${backupData.length} item rates to ${backupPath}\n`);

  // Step 3: Identify items needing list price updates
  let updateCount = 0;
  const srpItems: Array<{ item_id: string; pricebook_rate: number }> = [];
  const unmatchedItems: string[] = [];
  const noSrpItems: string[] = [];

  for (const group of groups) {
    const collection = matchCollection(group);
    if (!collection) {
      if (!group.group_name.startsWith("*")) {
        unmatchedItems.push(`${group.group_name} [${group.brand}]`);
      }
      continue;
    }

    const expectedListPrice = LIST_PRICES_2026[collection.slug];
    const srpPrice = SRP_2026[collection.slug];

    for (const item of group.items ?? []) {
      // Check if list price needs updating
      if (expectedListPrice && item.rate !== expectedListPrice) {
        console.log(
          `UPDATE LIST: ${item.name} rate ${item.rate} → ${expectedListPrice} (${collection.name})`,
        );
        if (!DRY_RUN) {
          await zohoPut(`/inventory/v1/items/${item.item_id}`, {
            rate: expectedListPrice,
          });
        }
        updateCount++;
      }

      // Collect SRP entries
      if (srpPrice) {
        srpItems.push({ item_id: item.item_id, pricebook_rate: srpPrice });
      } else {
        noSrpItems.push(`${item.name} [${collection.name}]`);
      }
    }
  }

  console.log(`\nList price updates: ${updateCount}${DRY_RUN ? " (dry run)" : ""}`);

  // Step 4: Create SRP26 price book
  console.log("\nChecking for existing SRP26 price book...");
  const existingBooks = await getPriceBooks();
  const existing = existingBooks.find((pb) => pb.name === "SRP26");

  if (existing) {
    console.log(`SRP26 already exists (id: ${existing.pricebook_id}). Skipping creation.`);
  } else {
    console.log("Creating SRP26 price book...");
    if (!DRY_RUN) {
      const result = await zohoPost("/inventory/v1/pricebooks", {
        name: "SRP26",
        pricebook_type: "per_item",
        currency_id: "",
        sales_or_purchase_type: "sales",
        pricebook_items: srpItems,
      });
      console.log("SRP26 created:", JSON.stringify(result, null, 2));
    } else {
      console.log(`Would create SRP26 with ${srpItems.length} item prices`);
    }
  }

  // Summary
  if (unmatchedItems.length > 0) {
    console.log(`\nUnmatched items (${unmatchedItems.length}):`);
    unmatchedItems.forEach((i) => console.log(`  - ${i}`));
  }

  if (noSrpItems.length > 0) {
    console.log(`\nItems with no SRP (${noSrpItems.length}):`);
    noSrpItems.slice(0, 10).forEach((i) => console.log(`  - ${i}`));
    if (noSrpItems.length > 10) console.log(`  ... +${noSrpItems.length - 10} more`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
