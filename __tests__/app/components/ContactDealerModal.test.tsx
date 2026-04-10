import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactDealerModal } from "@/app/components/ContactDealerModal";
import type { Dealer } from "@/lib/dealers/types";

const mockDealer: Dealer = {
  id: "dealer-001",
  name: "Brilliant Eye Care",
  email: "info@brillianteye.example.com",
  phone: "(847) 555-0123",
  address: { street: "123 E Main St", city: "Arlington Heights", state: "IL", zip: "60004" },
  coordinates: { lat: 42.0884, lng: -87.9806 },
};

describe("ContactDealerModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dealer name in heading", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    expect(screen.getByText(/Contact Brilliant Eye Care/)).toBeDefined();
  });

  it("renders name, email, and message fields", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    expect(screen.getByLabelText(/your name/i)).toBeDefined();
    expect(screen.getByLabelText(/your email/i)).toBeDefined();
    expect(screen.getByLabelText(/message/i)).toBeDefined();
  });

  it("shows product context when productSlug provided", () => {
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug="sp1018" />);
    expect(screen.getByText(/sp1018/i)).toBeDefined();
  });

  it("calls onClose when X button clicked", async () => {
    const onClose = vi.fn();
    render(<ContactDealerModal dealer={mockDealer} onClose={onClose} productSlug={null} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", async () => {
    const onClose = vi.fn();
    render(<ContactDealerModal dealer={mockDealer} onClose={onClose} productSlug={null} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("submits form and shows success message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "John Smith");
    await userEvent.type(screen.getByLabelText(/your email/i), "john@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText(/we've sent your info/i)).toBeDefined();
    });
  });

  it("shows validation errors for empty required fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: "Invalid form data",
        details: { customerName: ["Name is required"] },
      }),
    });
    render(<ContactDealerModal dealer={mockDealer} onClose={vi.fn()} productSlug={null} />);
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeDefined();
    });
  });
});
