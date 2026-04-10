import { describe, it, expect } from "vitest";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

describe("MOCK_DEALERS", () => {
  it("contains at least 10 dealers", () => {
    expect(MOCK_DEALERS.length).toBeGreaterThanOrEqual(10);
  });

  it("every dealer has all required fields", () => {
    for (const dealer of MOCK_DEALERS) {
      expect(dealer.id).toBeTruthy();
      expect(dealer.name).toBeTruthy();
      expect(dealer.email).toContain("@");
      expect(dealer.phone).toBeTruthy();
      expect(dealer.address.street).toBeTruthy();
      expect(dealer.address.city).toBeTruthy();
      expect(dealer.address.state).toHaveLength(2);
      expect(dealer.address.zip).toMatch(/^\d{5}$/);
      expect(dealer.coordinates.lat).toBeGreaterThan(0);
      expect(dealer.coordinates.lng).toBeLessThan(0);
    }
  });

  it("every dealer has a unique id", () => {
    const ids = MOCK_DEALERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
