import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VariantSelector } from "@/app/products/[slug]/VariantSelector";
import type { CatalogVariant } from "@/lib/catalog/types";

afterEach(cleanup);

function makeVariants(): CatalogVariant[] {
  return [
    { id: "v1", colorCode: "C1", colorName: "Black Glossed", inStock: true, image: "/img/black.jpg" },
    { id: "v2", colorCode: "C2", colorName: "Brown Matte", inStock: true, image: "/img/brown.jpg" },
    { id: "v3", colorCode: "C3", colorName: "Gray", inStock: false, image: "/img/gray.jpg" },
  ];
}

describe("VariantSelector", () => {
  it("renders all color variant buttons", () => {
    render(<VariantSelector variants={makeVariants()} productName="SG-1011" />);
    expect(screen.getByTitle("Black Glossed")).toBeInTheDocument();
    expect(screen.getByTitle("Brown Matte")).toBeInTheDocument();
    expect(screen.getByTitle("Gray (Out of Stock)")).toBeInTheDocument();
  });

  it("shows first variant color name by default", () => {
    render(<VariantSelector variants={makeVariants()} productName="SG-1011" />);
    expect(screen.getByText(/Color — Black Glossed/)).toBeInTheDocument();
  });

  it("changes selected color on button click", () => {
    render(<VariantSelector variants={makeVariants()} productName="SG-1011" />);
    fireEvent.click(screen.getByTitle("Brown Matte"));
    expect(screen.getByText(/Color — Brown Matte/)).toBeInTheDocument();
  });

  it("shows OOS badge for out-of-stock variant", () => {
    render(<VariantSelector variants={makeVariants()} productName="SG-1011" />);
    fireEvent.click(screen.getByTitle("Gray (Out of Stock)"));
    expect(screen.getByText("Temporarily Out of Stock")).toBeInTheDocument();
  });

  it("does NOT show OOS badge for in-stock variant", () => {
    render(<VariantSelector variants={makeVariants()} productName="SG-1011" />);
    expect(screen.queryByText("Temporarily Out of Stock")).not.toBeInTheDocument();
  });
});
