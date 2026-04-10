import { describe, it, expect } from "vitest";
import { haversineDistance, sortDealersByDistance, filterDealersByRadius } from "@/lib/dealers/distance";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    const dist = haversineDistance(42.0, -87.0, 42.0, -87.0);
    expect(dist).toBe(0);
  });

  it("calculates distance between Arlington Heights and Chicago (~22 miles)", () => {
    const dist = haversineDistance(42.0884, -87.9806, 41.8860, -87.6246);
    expect(dist).toBeGreaterThan(18);
    expect(dist).toBeLessThan(26);
  });
});

describe("sortDealersByDistance", () => {
  it("sorts dealers nearest first", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    expect(sorted[0].dealer.id).toBe("dealer-001");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].distance).toBeGreaterThanOrEqual(sorted[i - 1].distance);
    }
  });
});

describe("filterDealersByRadius", () => {
  it("filters to dealers within 10 miles of Arlington Heights", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    const nearby = filterDealersByRadius(sorted, 10);
    for (const entry of nearby) {
      expect(entry.distance).toBeLessThanOrEqual(10);
    }
  });

  it("returns all dealers when radius is null", () => {
    const userLat = 42.0884;
    const userLng = -87.9806;
    const sorted = sortDealersByDistance(MOCK_DEALERS, userLat, userLng);
    const all = filterDealersByRadius(sorted, null);
    expect(all.length).toBe(MOCK_DEALERS.length);
  });
});
