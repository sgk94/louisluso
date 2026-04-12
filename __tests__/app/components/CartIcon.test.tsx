import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartIcon } from "@/app/components/CartIcon";

const mockUseCart = vi.fn();

vi.mock("@/app/components/CartProvider", () => ({
  useCart: () => mockUseCart(),
}));

describe("CartIcon", () => {
  it("renders shopping bag icon link to quote", () => {
    mockUseCart.mockReturnValue({ totalQuantity: 3 });
    render(<CartIcon />);
    const link = screen.getByRole("link", { name: /quote/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/portal/quote");
  });

  it("shows count badge when items in cart", () => {
    mockUseCart.mockReturnValue({ totalQuantity: 3 });
    render(<CartIcon />);
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders accessible with aria-label", () => {
    mockUseCart.mockReturnValue({ totalQuantity: 3 });
    render(<CartIcon />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe("View quote");
  });

  it("hides badge when cart is empty", () => {
    mockUseCart.mockReturnValue({ totalQuantity: 0 });
    render(<CartIcon />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
