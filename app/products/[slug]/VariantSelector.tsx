"use client";

import { useState } from "react";
import Image from "next/image";
import type { CatalogVariant } from "@/lib/catalog/types";

interface VariantSelectorProps {
  variants: CatalogVariant[];
  productName: string;
}

export function VariantSelector({
  variants,
  productName,
}: VariantSelectorProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = variants[selectedIndex];

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        <Image
          src={selected?.image ?? "/images/placeholder-frame.svg"}
          alt={`${productName} ${selected?.colorName ?? ""}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-8"
          priority
        />
        {selected && !selected.inStock && (
          <div className="absolute left-0 top-0 bg-gray-900/80 px-3 py-1.5 text-xs font-medium uppercase text-white">
            Temporarily Out of Stock
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Color — {selected?.colorName ?? ""}
        </h3>
        <div className="mt-3 flex gap-2">
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              onClick={() => setSelectedIndex(index)}
              title={`${variant.colorName}${variant.inStock ? "" : " (Out of Stock)"}`}
              className={`h-8 w-8 rounded-full border-2 bg-gray-200 transition-all ${
                index === selectedIndex
                  ? "border-black"
                  : "border-transparent hover:border-gray-400"
              } ${!variant.inStock ? "opacity-40" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
