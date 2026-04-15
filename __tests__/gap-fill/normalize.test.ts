import { describe, expect, it } from "vitest";
import { normEmail, normCompany, normPhone, buildMatchKey } from "../../scripts/gap-fill/normalize.ts";

describe("normalize helpers", () => {
  it("normEmail lowercases and trims", () => {
    expect(normEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
    expect(normEmail(undefined)).toBe("");
  });

  it("normCompany strips non-alphanumerics and lowercases", () => {
    expect(normCompany("VANITY OPTICAL - CAD")).toBe("vanityopticalcad");
    expect(normCompany("")).toBe("");
  });

  it("normPhone keeps only digits", () => {
    expect(normPhone("(630) 855-5542")).toBe("6308555542");
    expect(normPhone("")).toBe("");
  });

  it("buildMatchKey prefers email, falls back to company", () => {
    expect(buildMatchKey("FOO@bar.com", "Acme")).toBe("email:foo@bar.com");
    expect(buildMatchKey("", "Acme Optical")).toBe("company:acmeoptical");
    expect(buildMatchKey("", "")).toBe("");
  });
});
