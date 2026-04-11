// lib/catalog/catalog.ts
import { cache } from "react";
import { getItemGroups, getPriceBooks, getPriceBook } from "@/lib/zoho/inventory";
import type { ZohoItemGroup } from "@/lib/zoho/inventory";
import { matchCollection, getCollectionBySlug } from "@/lib/catalog/collections";
import type { Collection } from "@/lib/catalog/collections";
import { parseColor, parseDimensions } from "@/lib/catalog/sku-parser";
import { getProductImageUrl, getVariantImageUrl } from "@/lib/catalog/images";
import type {
  CatalogProduct,
  CatalogVariant,
  CollectionDetail,
  CollectionWithProducts,
} from "@/lib/catalog/types";

const SRP_PRICE_BOOK_NAME = "SRP26";

interface SrpLookup {
  [itemId: string]: number;
}

async function loadSrpPrices(): Promise<SrpLookup> {
  const priceBooks = await getPriceBooks();
  const srpBook = priceBooks.find((pb) => pb.name === SRP_PRICE_BOOK_NAME);
  if (!srpBook) return {};

  const full = await getPriceBook(srpBook.pricebook_id);
  const lookup: SrpLookup = {};
  for (const item of full.pricebook_items ?? []) {
    lookup[item.item_id] = item.pricebook_rate;
  }
  return lookup;
}

function groupToProduct(
  group: ZohoItemGroup,
  collection: Collection,
  srpLookup: SrpLookup,
): CatalogProduct {
  const firstSku = group.items?.[0]?.sku ?? "";
  const dimensions = parseDimensions(firstSku);

  const listingPrice = group.items?.[0]?.rate ?? 0;

  let srp: number | null = null;
  const firstItemWithSrp = group.items?.find((item) => srpLookup[item.item_id]);
  if (firstItemWithSrp) {
    srp = srpLookup[firstItemWithSrp.item_id];
  } else {
    srp = collection.fallbackSrp;
  }

  const variants: CatalogVariant[] = (group.items ?? []).map((item) => {
    const parsed = parseColor(item.sku);
    const colorName = parsed?.colorName ?? item.name;
    return {
      id: item.item_id,
      colorCode: parsed?.colorCode ?? "",
      colorName,
      inStock: item.stock_on_hand > 0,
      image: getVariantImageUrl(group.group_name, colorName),
    };
  });

  return {
    id: group.group_id,
    slug: group.group_name.toLowerCase(),
    name: group.group_name,
    srp,
    listingPrice,
    image: getProductImageUrl(group.group_name),
    variants,
    dimensions,
  };
}

function toCollectionDetail(c: Collection): CollectionDetail {
  return {
    slug: c.slug,
    name: c.name,
    category: c.category,
    material: c.material,
  };
}

export const getCollectionProducts = cache(async function getCollectionProducts(
  slug: string,
): Promise<CollectionWithProducts | null> {
  const collection = getCollectionBySlug(slug);
  if (!collection) return null;

  const [groups, srpLookup] = await Promise.all([
    getItemGroups(),
    loadSrpPrices(),
  ]);

  const products: CatalogProduct[] = [];
  for (const group of groups) {
    const matched = matchCollection(group);
    if (matched?.slug === slug) {
      products.push(groupToProduct(group, collection, srpLookup));
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name));

  return {
    collection: toCollectionDetail(collection),
    products,
  };
});

export const getProductBySlug = cache(async function getProductBySlug(
  slug: string,
): Promise<{ product: CatalogProduct; collection: CollectionDetail } | null> {
  const [groups, srpLookup] = await Promise.all([
    getItemGroups(),
    loadSrpPrices(),
  ]);

  for (const group of groups) {
    if (group.group_name.toLowerCase() === slug) {
      const collection = matchCollection(group);
      if (!collection) return null;
      return {
        product: groupToProduct(group, collection, srpLookup),
        collection: toCollectionDetail(collection),
      };
    }
  }

  return null;
});

export async function getAllProductSlugs(): Promise<Array<{ slug: string }>> {
  const groups = await getItemGroups();
  const slugs: Array<{ slug: string }> = [];
  for (const group of groups) {
    const collection = matchCollection(group);
    if (collection) {
      slugs.push({ slug: group.group_name.toLowerCase() });
    }
  }
  return slugs;
}
