import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadCart,
  saveCart,
  addItems,
  updateQuantity,
  removeItem,
  clearCart,
  getTotalQuantity,
  getSubtotal,
  type CartItem,
} from "@/lib/portal/cart";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
  });
});

const item1: CartItem = {
  itemId: "item-1",
  productId: "group-1",
  productName: "SG-1011",
  colorName: "Black Glossed",
  quantity: 5,
  price: 76,
};

const item2: CartItem = {
  itemId: "item-2",
  productId: "group-1",
  productName: "SG-1011",
  colorName: "Black Matte",
  quantity: 10,
  price: 76,
};

describe("cart state", () => {
  it("loadCart returns empty array when no saved cart", () => {
    const cart = loadCart();
    expect(cart).toEqual([]);
  });

  it("saveCart persists and loadCart retrieves", () => {
    saveCart([item1]);
    const cart = loadCart();
    expect(cart).toEqual([item1]);
  });

  it("addItems adds new items", () => {
    const cart = addItems([], [item1, item2]);
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(5);
  });

  it("addItems merges quantity for existing item", () => {
    const existing = [{ ...item1, quantity: 3 }];
    const cart = addItems(existing, [{ ...item1, quantity: 5 }]);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(8);
  });

  it("addItems does not mutate input cart", () => {
    const existing = [{ ...item1, quantity: 3 }];
    const snapshot = JSON.parse(JSON.stringify(existing));
    addItems(existing, [{ ...item1, quantity: 5 }]);
    expect(existing).toEqual(snapshot);
  });

  it("updateQuantity changes item quantity", () => {
    const cart = updateQuantity([item1, item2], "item-1", 20);
    expect(cart.find((i) => i.itemId === "item-1")?.quantity).toBe(20);
  });

  it("updateQuantity with 0 removes item", () => {
    const cart = updateQuantity([item1, item2], "item-1", 0);
    expect(cart).toHaveLength(1);
    expect(cart[0].itemId).toBe("item-2");
  });

  it("removeItem removes by itemId", () => {
    const cart = removeItem([item1, item2], "item-1");
    expect(cart).toHaveLength(1);
    expect(cart[0].itemId).toBe("item-2");
  });

  it("clearCart returns empty array", () => {
    const cart = clearCart();
    expect(cart).toEqual([]);
  });

  it("getTotalQuantity sums all quantities", () => {
    expect(getTotalQuantity([item1, item2])).toBe(15);
  });

  it("getSubtotal calculates price * quantity sum", () => {
    expect(getSubtotal([item1, item2])).toBe(5 * 76 + 10 * 76);
  });

  it("loadCart filters out invalid items from localStorage", () => {
    const mixed = [
      { itemId: "v1", productId: "g1", productName: "SG", colorName: "Black", quantity: 5, price: 76 },
      { itemId: "v2", quantity: "not-a-number", price: 76 }, // invalid: missing fields, wrong type
      { broken: true }, // completely invalid
    ];
    mockStorage["louisluso-cart"] = JSON.stringify(mixed);
    const cart = loadCart();
    expect(cart).toHaveLength(1);
    expect(cart[0].itemId).toBe("v1");
  });

  it("loadCart returns empty for non-array JSON", () => {
    mockStorage["louisluso-cart"] = JSON.stringify({ not: "array" });
    const cart = loadCart();
    expect(cart).toEqual([]);
  });

  it("loadCart returns empty for corrupt JSON", () => {
    mockStorage["louisluso-cart"] = "not valid json{{{";
    const cart = loadCart();
    expect(cart).toEqual([]);
  });
});
