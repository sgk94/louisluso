import Link from "next/link";
import Image from "next/image";
import type { CatalogProduct } from "@/lib/catalog/types";
import { PartnerPrice } from "./PartnerPrice";

interface ProductCardProps {
  product: CatalogProduct;
  isPartner?: boolean;
  bespokePrice?: number | null;
}

export function ProductCard({ product, isPartner = false, bespokePrice = null }: ProductCardProps): React.ReactElement {
  const allOutOfStock = product.variants.every((v) => !v.inStock);

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        <Image
          src={product.image ?? "/images/placeholder-frame.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        {allOutOfStock && (
          <div className="absolute left-0 top-0 bg-gray-900/80 px-2 py-1 text-xs font-medium uppercase text-white">
            Temporarily Out of Stock
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium uppercase tracking-wide">
          {product.name}
        </h3>
        <div className="mt-1">
          <PartnerPrice
            srp={product.srp}
            listingPrice={product.listingPrice}
            bespokePrice={bespokePrice}
            isPartner={isPartner}
          />
        </div>
        <div className="mt-2 flex gap-1">
          {product.variants.map((v) => (
            <span
              key={v.id}
              title={v.colorName}
              className="inline-block h-3 w-3 rounded-full border border-gray-300 bg-gray-200"
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
