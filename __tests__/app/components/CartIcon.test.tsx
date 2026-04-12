import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartIcon } from "@/app/components/CartIcon";

vi.mock("@/app/components/CartProvider", () => ({
  useCart: () => ({ totalQuantity: 3 }),
}));

describe("CartIcon", () => {
  it("renders shopping bag icon link to quote", () => {
    render(<CartIcon />);
    const link = screen.getByRole("link", { name: /quote/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/portal/quote");
  });

  it("shows count badge when items in cart", () => {
    render(<CartIcon />);
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders accessible with aria-label", () => {
    render(<CartIcon />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe("View quote");
  });
});
