import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: CatalogProduct[];
}

export function ProductGrid({
  products,
}: ProductGridProps): React.ReactElement {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">No products found in this collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
