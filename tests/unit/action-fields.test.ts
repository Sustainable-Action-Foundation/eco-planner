import { expect, test } from "playwright/test";

import { parseCsvList } from "../../src/functions/fields";

test.describe("parseCsvList", () => {
  test("splits comma-separated values", () => {
    expect(parseCsvList("one, two, three")).toEqual(["one", "two", "three"]);
  });

  test("splits semicolons, tabs, and newlines", () => {
    expect(parseCsvList("a;b\tc\nd\r\ne")).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("strips surrounding quotes and drops empties", () => {
    expect(parseCsvList('"one", \'two\', , "three" ')).toEqual(["one", "two", "three"]);
  });

  test("returns plain text as a single item", () => {
    expect(parseCsvList("just a value")).toEqual(["just a value"]);
  });

  test("returns nothing for blank input", () => {
    expect(parseCsvList("  \n ")).toEqual([]);
  });
});
