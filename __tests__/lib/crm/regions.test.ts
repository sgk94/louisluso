import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { matchRegion, REGIONS, type Region, getRegionName, lookupCity, updateKnowledgeBase, loadKnowledgeBase, KB_PATH } from "@/lib/crm/regions";
import { writeFileSync } from "fs";

describe("REGIONS", () => {
  it("exports a non-empty array of regions", () => {
    expect(REGIONS.length).toBeGreaterThan(0);
  });

  it("each region has slug, name, and zipPrefixes", () => {
    for (const r of REGIONS) {
      expect(r.slug).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.zipPrefixes.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate slugs", () => {
    const slugs = REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("matchRegion", () => {
  it("matches SoCal zip 90001", () => {
    expect(matchRegion("90001")).toBe("socal");
  });

  it("matches SoCal zip 93500 (high end of range)", () => {
    expect(matchRegion("93500")).toBe("socal");
  });

  it("matches NorCal zip 94102 (San Francisco)", () => {
    expect(matchRegion("94102")).toBe("norcal");
  });

  it("matches Dallas zip 75201", () => {
    expect(matchRegion("75201")).toBe("dallas");
  });

  it("matches Austin zip 78701", () => {
    expect(matchRegion("78701")).toBe("austin");
  });

  it("matches Las Vegas zip 89101", () => {
    expect(matchRegion("89101")).toBe("lasvegas");
  });

  it("matches Las Vegas zip 89148", () => {
    expect(matchRegion("89148")).toBe("lasvegas");
  });

  it("does NOT match Reno zip 89501 (prefix 895, outside 891)", () => {
    expect(matchRegion("89501")).toBeNull();
  });

  it("does NOT match Reno zip 88901 (prefix 889, outside 891)", () => {
    expect(matchRegion("88901")).toBeNull();
  });

  it("returns null for zip with no matching region", () => {
    expect(matchRegion("99999")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchRegion("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(matchRegion(undefined)).toBeNull();
  });

  it("handles zip with leading zeros", () => {
    expect(matchRegion("06001")).toBeNull();
  });
});

describe("knowledge base", () => {
  beforeEach(() => {
    writeFileSync(KB_PATH, "{}\n");
  });

  afterAll(() => {
    writeFileSync(KB_PATH, "{}\n");
  });

  it("lookupCity returns null for unknown city", () => {
    expect(lookupCity("Nowhere", "XX")).toBeNull();
  });

  it("updateKnowledgeBase writes entry and lookupCity finds it", () => {
    updateKnowledgeBase("Dallas", "TX", "75201", "dallas");

    const entry = lookupCity("Dallas", "TX");
    expect(entry).toEqual({
      state: "TX",
      city: "Dallas",
      zip: "75201",
      region: "dallas",
    });
  });

  it("lookupCity is case-insensitive", () => {
    updateKnowledgeBase("Los Angeles", "CA", "90001", "socal");

    expect(lookupCity("los angeles", "ca")).toEqual({
      state: "CA",
      city: "Los Angeles",
      zip: "90001",
      region: "socal",
    });
  });

  it("updateKnowledgeBase does not overwrite existing entry", () => {
    updateKnowledgeBase("Austin", "TX", "78701", null);
    updateKnowledgeBase("Austin", "TX", "78702", "austin");

    const entry = lookupCity("Austin", "TX");
    expect(entry?.zip).toBe("78701");
    expect(entry?.region).toBeNull();
  });

  it("loadKnowledgeBase returns all entries", () => {
    updateKnowledgeBase("Dallas", "TX", "75201", "dallas");
    updateKnowledgeBase("Houston", "TX", "77001", "houston");

    const kb = loadKnowledgeBase();
    expect(Object.keys(kb)).toHaveLength(2);
  });
});

describe("getRegionName", () => {
  it("returns name for valid slug", () => {
    expect(getRegionName("socal")).toBe("Southern California");
  });

  it("returns null for unknown slug", () => {
    expect(getRegionName("nowhere")).toBeNull();
  });
});
