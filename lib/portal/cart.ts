const CART_KEY = "louisluso-cart";

export interface CartItem {
  itemId: string;
  productId: string;
  productName: string;
  colorName: string;
  quantity: number;
  price: number;
}

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addItems(
  cart: CartItem[],
  newItems: CartItem[]
): CartItem[] {
  let result = cart.map((i) => ({ ...i }));
  for (const item of newItems) {
    const idx = result.findIndex((i) => i.itemId === item.itemId);
    if (idx >= 0) {
      result[idx] = { ...result[idx], quantity: result[idx].quantity + item.quantity };
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

export function updateQuantity(
  cart: CartItem[],
  itemId: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) return cart.filter((i) => i.itemId !== itemId);
  return cart.map((i) =>
    i.itemId === itemId ? { ...i, quantity } : i
  );
}

export function removeItem(cart: CartItem[], itemId: string): CartItem[] {
  return cart.filter((i) => i.itemId !== itemId);
}

export function clearCart(): CartItem[] {
  return [];
}

export function getTotalQuantity(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function getSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
}
