import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductCard } from "@/app/components/ProductCard";
import type { CatalogProduct } from "@/lib/catalog/types";

afterEach(cleanup);

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "g1",
    slug: "sg-1011",
    name: "SG-1011",
    srp: 227,
    image: "/images/placeholder-frame.svg",
    variants: [
      { id: "v1", colorCode: "C1", colorName: "Black Glossed", inStock: true, image: null },
      { id: "v2", colorCode: "C2", colorName: "Black Matte", inStock: true, image: null },
    ],
    dimensions: { lens: 56, bridge: 17, temple: 140 },
    ...overrides,
  };
}

describe("ProductCard", () => {
  it("renders product name", () => {
    render(<ProductCard product={makeProduct()} />);
    expect(screen.getByText("SG-1011")).toBeInTheDocument();
  });

  it("renders formatted SRP price", () => {
    render(<ProductCard product={makeProduct({ srp: 227 })} />);
    expect(screen.getByText(/\$227/)).toBeInTheDocument();
  });

  it("renders 'Contact for pricing' when SRP is null", () => {
    render(<ProductCard product={makeProduct({ srp: null })} />);
    expect(screen.getByText("Contact for pricing")).toBeInTheDocument();
  });

  it("links to product detail page", () => {
    render(<ProductCard product={makeProduct()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products/sg-1011");
  });

  it("renders color swatches for each variant", () => {
    render(<ProductCard product={makeProduct()} />);
    expect(screen.getByTitle("Black Glossed")).toBeInTheDocument();
    expect(screen.getByTitle("Black Matte")).toBeInTheDocument();
  });

  it("shows 'Temporarily Out of Stock' when all variants are OOS", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", colorCode: "C1", colorName: "Black", inStock: false, image: null },
        { id: "v2", colorCode: "C2", colorName: "Brown", inStock: false, image: null },
      ],
    });
    render(<ProductCard product={product} />);
    expect(screen.getByText("Temporarily Out of Stock")).toBeInTheDocument();
  });

  it("does NOT show OOS badge when some variants are in stock", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", colorCode: "C1", colorName: "Black", inStock: true, image: null },
        { id: "v2", colorCode: "C2", colorName: "Brown", inStock: false, image: null },
      ],
    });
    render(<ProductCard product={product} />);
    expect(screen.queryByText("Temporarily Out of Stock")).not.toBeInTheDocument();
  });
});
