import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import QuoteSuccessPage from "@/app/portal/quote/success/[estimateNumber]/page";

describe("QuoteSuccessPage (redirect shim)", () => {
  beforeEach(() => redirectMock.mockClear());

  it("redirects to /portal/quotes/[estimateNumber] with the URL-encoded number", async () => {
    await QuoteSuccessPage({ params: Promise.resolve({ estimateNumber: "EST-001" }) });
    expect(redirectMock).toHaveBeenCalledWith("/portal/quotes/EST-001");
  });

  it("URL-encodes special characters in the estimate number", async () => {
    await QuoteSuccessPage({ params: Promise.resolve({ estimateNumber: "EST 001/X" }) });
    expect(redirectMock).toHaveBeenCalledWith("/portal/quotes/EST%20001%2FX");
  });
});
