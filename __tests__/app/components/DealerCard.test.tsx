import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DealerCard } from "@/app/components/DealerCard";
import type { Dealer } from "@/lib/dealers/types";

const mockDealer: Dealer = {
  id: "dealer-001",
  name: "Brilliant Eye Care",
  email: "info@brillianteye.example.com",
  phone: "(847) 555-0123",
  address: { street: "123 E Main St", city: "Arlington Heights", state: "IL", zip: "60004" },
  coordinates: { lat: 42.0884, lng: -87.9806 },
};

describe("DealerCard", () => {
  it("renders dealer name and location", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    expect(screen.getByText("Brilliant Eye Care")).toBeDefined();
    expect(screen.getByText("Arlington Heights, IL")).toBeDefined();
    expect(screen.getByText("2.3 mi")).toBeDefined();
  });

  it("renders Call link with tel: href", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    const callLink = screen.getByRole("link", { name: /call/i });
    expect(callLink.getAttribute("href")).toBe("tel:(847) 555-0123");
  });

  it("renders Directions link opening Google Maps", () => {
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={vi.fn()} />);
    const dirLink = screen.getByRole("link", { name: /directions/i });
    expect(dirLink.getAttribute("href")).toContain("google.com/maps");
    expect(dirLink.getAttribute("target")).toBe("_blank");
  });

  it("calls onContact when Contact button clicked", async () => {
    const onContact = vi.fn();
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={vi.fn()} onContact={onContact} />);
    await userEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(onContact).toHaveBeenCalledWith(mockDealer);
  });

  it("calls onSelect when card clicked", async () => {
    const onSelect = vi.fn();
    render(<DealerCard dealer={mockDealer} distance={2.3} selected={false} onSelect={onSelect} onContact={vi.fn()} />);
    await userEvent.click(screen.getByText("Brilliant Eye Care"));
    expect(onSelect).toHaveBeenCalledWith(mockDealer);
  });

  it("applies selected styles when selected", () => {
    const { container } = render(<DealerCard dealer={mockDealer} distance={2.3} selected={true} onSelect={vi.fn()} onContact={vi.fn()} />);
    const card = container.firstElementChild;
    expect(card?.className).toContain("border-l-bronze");
  });
});
