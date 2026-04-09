import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductGrid } from "@/app/components/ProductGrid";
import type { CatalogProduct } from "@/lib/catalog/types";

afterEach(cleanup);

function makeProduct(name: string, slug: string): CatalogProduct {
  return {
    id: `g-${slug}`,
    slug,
    name,
    srp: 227,
    image: "/images/placeholder-frame.svg",
    variants: [
      { id: `${slug}-v1`, colorCode: "C1", colorName: "Black", inStock: true, image: null },
    ],
    dimensions: { lens: 56, bridge: 17, temple: 140 },
  };
}

describe("ProductGrid", () => {
  it("renders product names for each product", () => {
    const products = [
      makeProduct("SG-1011", "sg-1011"),
      makeProduct("SG-1012", "sg-1012"),
      makeProduct("SG-1013", "sg-1013"),
    ];
    render(<ProductGrid products={products} />);
    expect(screen.getByText("SG-1011")).toBeInTheDocument();
    expect(screen.getByText("SG-1012")).toBeInTheDocument();
    expect(screen.getByText("SG-1013")).toBeInTheDocument();
  });

  it("renders empty state when no products", () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText("No products found in this collection.")).toBeInTheDocument();
  });
});
