import { expect, test } from "playwright/test";
import { parseDecimalInput } from "../../src/functions/parseDecimalInput";

test.describe("parseDecimalInput", () => {
  test("parses plain and signed decimals", () => {
    expect(parseDecimalInput("1")).toBe(1);
    expect(parseDecimalInput("1.5")).toBe(1.5);
    expect(parseDecimalInput("-0.25")).toBe(-0.25);
    expect(parseDecimalInput("+3")).toBe(3);
    expect(parseDecimalInput("1e3")).toBe(1000);
  });

  test("accepts a decimal comma", () => {
    expect(parseDecimalInput("1,5")).toBe(1.5);
    expect(parseDecimalInput(",5")).toBe(0.5);
  });

  test("ignores grouping whitespace, including NBSP and thin space", () => {
    expect(parseDecimalInput("18 800")).toBe(18800);
    expect(parseDecimalInput("18 800,5")).toBe(18800.5);
    expect(parseDecimalInput("18 800")).toBe(18800);
    expect(parseDecimalInput(" 42 ")).toBe(42);
  });

  test("returns null instead of NaN for anything unparsable", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("   ")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("1.2.3")).toBeNull();
    expect(parseDecimalInput("1,234.5")).toBeNull();
    expect(parseDecimalInput("Infinity")).toBeNull();
  });
});
