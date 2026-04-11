import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnerPrice } from "@/app/components/PartnerPrice";

describe("PartnerPrice", () => {
  it("renders SRP for public visitors", () => {
    render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={null} isPartner={false} />);
    expect(screen.getByText("$227")).toBeInTheDocument();
    expect(screen.queryByText("$76")).not.toBeInTheDocument();
  });

  it("renders 'Contact for pricing' when SRP is null and not partner", () => {
    render(<PartnerPrice srp={null} listingPrice={76} bespokePrice={null} isPartner={false} />);
    expect(screen.getByText("Contact for pricing")).toBeInTheDocument();
  });

  it("renders listing price for default partner", () => {
    render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={null} isPartner={true} />);
    expect(screen.getByText("$76")).toBeInTheDocument();
    expect(screen.queryByText("$227")).not.toBeInTheDocument();
  });

  it("renders strikethrough listing + green pill for bespoke partner", () => {
    const { container } = render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={68} isPartner={true} />);
    const strikethrough = container.querySelector("s");
    expect(strikethrough).not.toBeNull();
    expect(strikethrough?.textContent).toBe("$76");
    expect(screen.getByText("$68")).toBeInTheDocument();
  });

  it("shows just listing price when bespoke equals listing", () => {
    const { container } = render(<PartnerPrice srp={227} listingPrice={76} bespokePrice={76} isPartner={true} />);
    expect(container.querySelector("s")).toBeNull();
    expect(screen.getByText("$76")).toBeInTheDocument();
  });
});
