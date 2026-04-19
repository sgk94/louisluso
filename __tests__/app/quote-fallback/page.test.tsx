import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuoteFallbackPage from "@/app/quote-fallback/page";

describe("QuoteFallbackPage", () => {
  it("renders the form with required fields and a submit button", () => {
    render(<QuoteFallbackPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/products/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
