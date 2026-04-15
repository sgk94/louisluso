import { describe, expect, it } from "vitest";
import { toStateCode } from "../../scripts/cf-state-fill/state-codes.ts";

describe("toStateCode", () => {
  it("returns code unchanged when already a US 2-letter code", () => {
    expect(toStateCode("CA")).toBe("CA");
    expect(toStateCode("ca")).toBe("CA");
    expect(toStateCode(" TX ")).toBe("TX");
  });

  it("maps full US state names to codes", () => {
    expect(toStateCode("California")).toBe("CA");
    expect(toStateCode("new york")).toBe("NY");
    expect(toStateCode("North Dakota")).toBe("ND");
  });

  it("maps Canadian province names + codes", () => {
    expect(toStateCode("British Columbia")).toBe("BC");
    expect(toStateCode("ON")).toBe("ON");
    expect(toStateCode("ontario")).toBe("ON");
  });

  it("returns null for empty / garbage input", () => {
    expect(toStateCode("")).toBeNull();
    expect(toStateCode("   ")).toBeNull();
    expect(toStateCode("not a state")).toBeNull();
    expect(toStateCode(undefined)).toBeNull();
    expect(toStateCode(null)).toBeNull();
  });

  it("country hint biases lookup: 'CA' is California in US, not a province in Canada", () => {
    expect(toStateCode("CA", "Canada")).toBeNull();
    expect(toStateCode("CA", "USA")).toBe("CA");
    expect(toStateCode("CA")).toBe("CA");
  });

  it("country hint accepts BC as British Columbia in Canada", () => {
    expect(toStateCode("BC", "Canada")).toBe("BC");
    expect(toStateCode("BC", "USA")).toBeNull();
    expect(toStateCode("BC")).toBe("BC");
  });

  it("ignores surrounding whitespace + mixed case", () => {
    expect(toStateCode("  cAlIfOrNiA ")).toBe("CA");
  });
});
