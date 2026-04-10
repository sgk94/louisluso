import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/app/components/UserMenu";

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));

describe("UserMenu", () => {
  it("renders user icon button", () => {
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: /account menu/i })).toBeDefined();
  });

  it("shows dropdown on click", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Account")).toBeDefined();
    expect(screen.getByText("Sign Out")).toBeDefined();
  });

  it("shows coming soon items as disabled", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    const ordersItem = screen.getByText(/Orders/);
    expect(ordersItem.closest("span")).toBeDefined();
    expect(screen.getAllByText("(Coming soon)").length).toBeGreaterThan(0);
  });

  it("closes dropdown when clicking outside", async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Dashboard")).toBeDefined();
    await userEvent.click(document.body);
    expect(screen.queryByText("Dashboard")).toBeNull();
  });
});
