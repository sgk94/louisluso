"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";

export function CartIcon(): React.ReactElement {
  const { totalQuantity } = useCart();

  return (
    <Link
      href="/portal/quote"
      aria-label="View quote"
      className="relative text-gray-500 transition-colors hover:text-bronze"
    >
      <ShoppingBagIcon className="h-5 w-5" />
      {totalQuantity > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bronze px-1 text-[10px] font-bold text-white">
          {totalQuantity}
        </span>
      )}
    </Link>
  );
}
