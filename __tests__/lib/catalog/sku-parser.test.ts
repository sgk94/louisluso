import { describe, it, expect } from "vitest";
import { parseColor, parseDimensions } from "@/lib/catalog/sku-parser";

describe("parseColor", () => {
  it("parses CO.{number} format", () => {
    expect(parseColor("SIGNATURE 56/17/140  CO.1  BLACK GLOSSED")).toEqual({
      colorCode: "C1",
      colorName: "Black Glossed",
    });
  });

  it("parses CO.{number} with multi-word color", () => {
    expect(parseColor("SIGNATURE 56/17/140  CO.24  GRAY GLOSSED")).toEqual({
      colorCode: "C24",
      colorName: "Gray Glossed",
    });
  });

  it("parses C{number}. format (Manomos)", () => {
    expect(
      parseColor("MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass"),
    ).toEqual({
      colorCode: "C1",
      colorName: "Gold Green",
    });
  });

  it("strips 'Sunglass' suffix from color name", () => {
    expect(
      parseColor("MANOMOS ABBEY 52/22/145 C2. BROWN/GOLD Sunglass"),
    ).toEqual({
      colorCode: "C2",
      colorName: "Brown/Gold",
    });
  });

  it("parses CO. format with slash in color name", () => {
    expect(
      parseColor("LL(T)-5001/1 LOUISLUSO TITANIUM(T) 50/19/140 CO.1 BLACK/GOLD"),
    ).toEqual({
      colorCode: "C1",
      colorName: "Black/Gold",
    });
  });

  it("returns null for unparseable SKU", () => {
    expect(parseColor("SOME RANDOM TEXT")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseColor("")).toBeNull();
  });
});

describe("parseDimensions", () => {
  it("parses standard dimensions from SKU", () => {
    expect(
      parseDimensions("SIGNATURE 56/17/140  CO.1  BLACK GLOSSED"),
    ).toEqual({ lens: 56, bridge: 17, temple: 140 });
  });

  it("parses dimensions from Manomos SKU", () => {
    expect(
      parseDimensions("MANOMOS LEON 54/20/145 C1. GOLD GREEN Sunglass"),
    ).toEqual({ lens: 54, bridge: 20, temple: 145 });
  });

  it("parses dimensions from Titanium SKU", () => {
    expect(
      parseDimensions(
        "LL(T)-5001/1 LOUISLUSO TITANIUM(T) 50/19/140 CO.1 BLACK/GOLD",
      ),
    ).toEqual({ lens: 50, bridge: 19, temple: 140 });
  });

  it("returns null when no dimensions found", () => {
    expect(parseDimensions("NO DIMENSIONS HERE")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDimensions("")).toBeNull();
  });
});
