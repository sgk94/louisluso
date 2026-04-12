"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { loadCart, saveCart, addItems, updateQuantity, removeItem, clearCart, getTotalQuantity, getSubtotal, type CartItem, CART_KEY } from "@/lib/portal/cart";

interface CartContextValue {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  add: (newItems: CartItem[]) => void;
  update: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(loadCart());
    const sync = (e: StorageEvent) => {
      if (e.key === CART_KEY) setItems(loadCart());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const add = useCallback((newItems: CartItem[]) => {
    setItems((prev) => {
      const updated = addItems(prev, newItems);
      saveCart(updated);
      return updated;
    });
  }, []);

  const update = useCallback((itemId: string, quantity: number) => {
    setItems((prev) => {
      const updated = updateQuantity(prev, itemId, quantity);
      saveCart(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((itemId: string) => {
    setItems((prev) => {
      const updated = removeItem(prev, itemId);
      saveCart(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    const empty = clearCart();
    setItems(empty);
    saveCart(empty);
  }, []);

  const value = useMemo(
    () => ({
      items,
      totalQuantity: getTotalQuantity(items),
      subtotal: getSubtotal(items),
      add,
      update,
      remove,
      clear,
    }),
    [items, add, update, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
