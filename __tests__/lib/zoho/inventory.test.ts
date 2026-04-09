import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockZohoFetch } = vi.hoisted(() => ({
  mockZohoFetch: vi.fn(),
}));

vi.mock("@/lib/zoho/client", () => ({
  zohoFetch: mockZohoFetch,
}));

import {
  getItems,
  getItemGroup,
  getItemGroups,
  getPriceLists,
  getPriceList,
} from "@/lib/zoho/inventory";

describe("Zoho Inventory API", () => {
  beforeEach(() => {
    mockZohoFetch.mockReset();
  });

  describe("getItems", () => {
    it("fetches items with page and per_page params", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        items: [
          { item_id: "1", name: "Frame A", sku: "FA-001", rate: 100 },
        ],
        page_context: { has_more_page: false },
      });

      const result = await getItems();

      expect(mockZohoFetch).toHaveBeenCalledWith("/inventory/v1/items", {
        params: { page: "1", per_page: "200" },
      });
      expect(result).toEqual([
        { item_id: "1", name: "Frame A", sku: "FA-001", rate: 100 },
      ]);
    });

    it("returns empty array when no items exist", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        items: [],
        page_context: { has_more_page: false },
      });

      const result = await getItems();

      expect(result).toEqual([]);
    });

    it("recursively fetches all pages when has_more_page is true", async () => {
      mockZohoFetch
        .mockResolvedValueOnce({
          items: [{ item_id: "1", name: "A", sku: "A1", rate: 10 }],
          page_context: { has_more_page: true },
        })
        .mockResolvedValueOnce({
          items: [{ item_id: "2", name: "B", sku: "B1", rate: 20 }],
          page_context: { has_more_page: true },
        })
        .mockResolvedValueOnce({
          items: [{ item_id: "3", name: "C", sku: "C1", rate: 30 }],
          page_context: { has_more_page: false },
        });

      const result = await getItems();

      expect(mockZohoFetch).toHaveBeenCalledTimes(3);
      expect(mockZohoFetch).toHaveBeenNthCalledWith(
        1,
        "/inventory/v1/items",
        { params: { page: "1", per_page: "200" } },
      );
      expect(mockZohoFetch).toHaveBeenNthCalledWith(
        2,
        "/inventory/v1/items",
        { params: { page: "2", per_page: "200" } },
      );
      expect(mockZohoFetch).toHaveBeenNthCalledWith(
        3,
        "/inventory/v1/items",
        { params: { page: "3", per_page: "200" } },
      );
      expect(result).toHaveLength(3);
      expect(result[0].item_id).toBe("1");
      expect(result[2].item_id).toBe("3");
    });
  });

  describe("getItemGroup", () => {
    it("fetches a single item group by ID", async () => {
      const group = {
        group_id: "g1",
        group_name: "Signature Series",
        items: [
          { item_id: "1", name: "SG1011-C1", sku: "SG1011-C1", rate: 100 },
        ],
      };
      mockZohoFetch.mockResolvedValueOnce({ item_group: group });

      const result = await getItemGroup("g1");

      expect(mockZohoFetch).toHaveBeenCalledWith(
        "/inventory/v1/itemgroups/g1",
      );
      expect(result).toEqual(group);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("getItemGroups", () => {
    it("fetches item groups list with pagination", async () => {
      mockZohoFetch.mockResolvedValueOnce({
        itemgroups: [
          { group_id: "g1", group_name: "Signature", items: [] },
          { group_id: "g2", group_name: "Classic", items: [] },
        ],
        page_context: { has_more_page: false },
      });

      const result = await getItemGroups();

      expect(mockZohoFetch).toHaveBeenCalledWith(
        "/inventory/v1/itemgroups",
        { params: { page: "1", per_page: "200" } },
      );
      expect(result).toHaveLength(2);
      expect(result[0].group_name).toBe("Signature");
    });

    it("recursively fetches all pages", async () => {
      mockZohoFetch
        .mockResolvedValueOnce({
          itemgroups: [{ group_id: "g1", group_name: "A", items: [] }],
          page_context: { has_more_page: true },
        })
        .mockResolvedValueOnce({
          itemgroups: [{ group_id: "g2", group_name: "B", items: [] }],
          page_context: { has_more_page: false },
        });

      const result = await getItemGroups();

      expect(mockZohoFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });

  describe("getPriceLists", () => {
    it("returns price lists array", async () => {
      const priceLists = [
        { pricelist_id: "p1", name: "Wholesale", type: "percentage" },
        { pricelist_id: "p2", name: "Retail", type: "fixed" },
      ];
      mockZohoFetch.mockResolvedValueOnce({ pricelists: priceLists });

      const result = await getPriceLists();

      expect(mockZohoFetch).toHaveBeenCalledWith("/inventory/v1/pricelists");
      expect(result).toEqual(priceLists);
      expect(result).toHaveLength(2);
    });
  });

  describe("getPriceList", () => {
    it("fetches a single price list by ID", async () => {
      const priceList = {
        pricelist_id: "p1",
        name: "Wholesale",
        type: "percentage",
        percentage: 30,
        item_prices: [{ item_id: "1", price: 70 }],
      };
      mockZohoFetch.mockResolvedValueOnce({ pricelist: priceList });

      const result = await getPriceList("p1");

      expect(mockZohoFetch).toHaveBeenCalledWith(
        "/inventory/v1/pricelists/p1",
      );
      expect(result).toEqual(priceList);
    });
  });
});
