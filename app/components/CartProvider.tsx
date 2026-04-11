"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { loadCart, saveCart, addItems, updateQuantity, removeItem, clearCart, getTotalQuantity, getSubtotal, type CartItem } from "@/lib/portal/cart";

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

  return (
    <CartContext.Provider
      value={{
        items,
        totalQuantity: getTotalQuantity(items),
        subtotal: getSubtotal(items),
        add,
        update,
        remove,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
