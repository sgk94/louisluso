import { zohoFetch } from "@/lib/zoho/client";

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

export async function getItems(page: number = 1): Promise<ZohoItem[]> {
  const response = await zohoFetch<ItemsResponse>("/inventory/v1/items", {
    params: { page: String(page), per_page: "200" },
  });

  const items = response.items;

  if (response.page_context.has_more_page) {
    const nextItems = await getItems(page + 1);
    return [...items, ...nextItems];
  }

  return items;
}

export async function getItemGroup(groupId: string): Promise<ZohoItemGroup> {
  const response = await zohoFetch<ItemGroupResponse>(
    `/inventory/v1/itemgroups/${groupId}`,
  );
  return response.item_group;
}

export async function getItemGroups(
  page: number = 1,
): Promise<ZohoItemGroup[]> {
  const response = await zohoFetch<ItemGroupsResponse>(
    "/inventory/v1/itemgroups",
    { params: { page: String(page), per_page: "200" } },
  );

  const groups = response.itemgroups;

  if (response.page_context.has_more_page) {
    const nextGroups = await getItemGroups(page + 1);
    return [...groups, ...nextGroups];
  }

  return groups;
}

export async function getPriceLists(): Promise<ZohoPriceList[]> {
  const response =
    await zohoFetch<PriceListsResponse>("/inventory/v1/pricelists");
  return response.pricelists;
}

export async function getPriceListForContact(
  priceListId: string,
): Promise<ZohoPriceList> {
  const response = await zohoFetch<PriceListResponse>(
    `/inventory/v1/pricelists/${priceListId}`,
  );
  return response.pricelist;
}
