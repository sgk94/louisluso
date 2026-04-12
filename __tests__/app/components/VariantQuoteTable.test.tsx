import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariantQuoteTable } from "@/app/components/VariantQuoteTable";
import type { CatalogVariant } from "@/lib/catalog/types";

const mockAdd = vi.fn();
vi.mock("@/app/components/CartProvider", () => ({
  useCart: () => ({ add: mockAdd, items: [] }),
}));

const variants: CatalogVariant[] = [
  { id: "v1", colorCode: "C1", colorName: "Black Glossed", inStock: true, image: null },
  { id: "v2", colorCode: "C2", colorName: "Black Matte", inStock: true, image: null },
  { id: "v3", colorCode: "C3", colorName: "Brown", inStock: false, image: null },
];

describe("VariantQuoteTable", () => {
  beforeEach(() => {
    mockAdd.mockClear();
  });

  it("renders all variants with color names", () => {
    render(
      <VariantQuoteTable
        variants={variants}
        productId="g1"
        productName="SG-1011"
        price={76}
      />
    );
    expect(screen.getByText("Black Glossed")).toBeDefined();
    expect(screen.getByText("Black Matte")).toBeDefined();
    expect(screen.getByText("Brown")).toBeDefined();
  });

  it("does not render quantity input for OOS variants", () => {
    render(
      <VariantQuoteTable
        variants={variants}
        productId="g1"
        productName="SG-1011"
        price={76}
      />
    );
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(2); // Only in-stock variants get inputs
  });

  it("shows Out of Stock label for OOS variants", () => {
    render(
      <VariantQuoteTable
        variants={variants}
        productId="g1"
        productName="SG-1011"
        price={76}
      />
    );
    expect(screen.getByText("Out of Stock")).toBeDefined();
  });

  it("Add to Quote button disabled when all quantities are 0", () => {
    render(
      <VariantQuoteTable
        variants={variants}
        productId="g1"
        productName="SG-1011"
        price={76}
      />
    );
    expect(screen.getByRole("button", { name: /add to quote/i })).toBeDisabled();
  });

  it("calls cart.add when Add to Quote clicked with quantities", async () => {
    render(
      <VariantQuoteTable
        variants={variants}
        productId="g1"
        productName="SG-1011"
        price={76}
      />
    );
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "5");
    await userEvent.click(screen.getByRole("button", { name: /add to quote/i }));
    expect(mockAdd).toHaveBeenCalledWith([
      expect.objectContaining({ itemId: "v1", quantity: 5, price: 76 }),
    ]);
  });
});
