import { z } from "zod";
import { zohoFetch } from "@/lib/zoho/client";

const zohoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid Zoho ID");

export interface ZohoItem {
  item_id: string;
  name: string;
  sku: string;
  rate: number;
  stock_on_hand: number;
  status: string;
  group_id?: string;
  group_name?: string;
  image_name?: string;
  custom_fields?: Array<{ label: string; value: string }>;
}

export interface ZohoItemGroup {
  group_id: string;
  group_name: string;
  items: ZohoItem[];
  image_name?: string;
  description?: string;
  brand?: string;
  category_name?: string;
}

export interface ZohoPriceList {
  pricelist_id: string;
  name: string;
  type: string;
  percentage?: number;
  item_prices?: Array<{ item_id: string; price: number }>;
}

interface PageContext {
  has_more_page: boolean;
}

interface ItemsResponse {
  items: ZohoItem[];
  page_context: PageContext;
}

interface ItemGroupResponse {
  item_group: ZohoItemGroup;
}

interface ItemGroupsResponse {
  itemgroups: ZohoItemGroup[];
  page_context: PageContext;
}

interface PriceListsResponse {
  pricelists: ZohoPriceList[];
}

interface PriceListResponse {
  pricelist: ZohoPriceList;
}

const MAX_PAGES = 50;

export async function getItems(): Promise<ZohoItem[]> {
  const allItems: ZohoItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await zohoFetch<ItemsResponse>("/inventory/v1/items", {
      params: { page: String(page), per_page: "200" },
    });
    allItems.push(...response.items);
    if (!response.page_context.has_more_page) break;
  }
  return allItems;
}

export async function getItemGroup(groupId: string): Promise<ZohoItemGroup> {
  const parsed = zohoIdSchema.safeParse(groupId);
  if (!parsed.success) throw new Error("Invalid group ID");

  const response = await zohoFetch<ItemGroupResponse>(
    `/inventory/v1/itemgroups/${parsed.data}`,
  );
  return response.item_group;
}

export async function getItemGroups(): Promise<ZohoItemGroup[]> {
  const allGroups: ZohoItemGroup[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await zohoFetch<ItemGroupsResponse>(
      "/inventory/v1/itemgroups",
      { params: { page: String(page), per_page: "200" } },
    );
    allGroups.push(...response.itemgroups);
    if (!response.page_context.has_more_page) break;
  }
  return allGroups;
}

export async function getPriceLists(): Promise<ZohoPriceList[]> {
  const response =
    await zohoFetch<PriceListsResponse>("/inventory/v1/pricelists");
  return response.pricelists;
}

export async function getPriceList(
  priceListId: string,
): Promise<ZohoPriceList> {
  const parsed = zohoIdSchema.safeParse(priceListId);
  if (!parsed.success) throw new Error("Invalid price list ID");

  const response = await zohoFetch<PriceListResponse>(
    `/inventory/v1/pricelists/${parsed.data}`,
  );
  return response.pricelist;
}
