"use client";

import { useState, useRef, useEffect } from "react";
import type { CatalogVariant } from "@/lib/catalog/types";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/catalog/format";
import type { CartItem } from "@/lib/portal/cart";

interface VariantQuoteTableProps {
  variants: CatalogVariant[];
  productId: string;
  productName: string;
  price: number;
}

export function VariantQuoteTable({
  variants,
  productId,
  productName,
  price,
}: VariantQuoteTableProps): React.ReactElement {
  const { add } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function setQty(variantId: string, qty: number): void {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, qty) }));
  }

  const hasItems = Object.values(quantities).some((q) => q > 0);

  function handleAdd(): void {
    const items: CartItem[] = [];
    for (const variant of variants) {
      const qty = quantities[variant.id] ?? 0;
      if (qty > 0) {
        items.push({
          itemId: variant.id,
          productId,
          productName,
          colorName: variant.colorName,
          quantity: qty,
          price,
        });
      }
    }
    if (items.length > 0) {
      add(items);
      setQuantities({});
      setAdded(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAdded(false), 2000);
    }
  }

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Order by Variant
      </h3>
      <div className="mt-3 space-y-2">
        {variants.map((variant) => {
          const qty = quantities[variant.id] ?? 0;
          const lineTotal = qty * price;
          return (
            <div key={variant.id} className="flex items-center gap-4 text-sm">
              <span className="w-40 truncate">{variant.colorName}</span>
              {variant.inStock ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) =>
                      setQty(variant.id, parseInt(e.target.value) || 0)
                    }
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                  />
                  {lineTotal > 0 && (
                    <span className="text-xs text-gray-500">
                      {formatPrice(lineTotal)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-400">Out of Stock</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleAdd}
        disabled={!hasItems}
        className="mt-6 w-full border border-bronze bg-bronze px-8 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {added ? "Added!" : "Add to Quote"}
      </button>
    </div>
  );
}
