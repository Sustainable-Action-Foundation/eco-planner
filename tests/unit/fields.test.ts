import { expect, test } from "playwright/test";

import {
  actionContentDiffers,
  ActionFieldHeaders,
  defaultActionFieldType,
  getActionDescription,
  getActionFieldValue,
  groupActionFields,
  parseActionFieldType,
  parseCsvList,
} from "../../src/functions/fields";
import { ActionFieldType } from "../../src/lib/prisma/generated";

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

  test("only matching quote pairs are stripped", () => {
    expect(parseCsvList("\"mixed', 'inner \"quoted\" text'")).toEqual(["\"mixed'", 'inner "quoted" text']);
  });

  test("returns plain text as a single item", () => {
    expect(parseCsvList("just a value")).toEqual(["just a value"]);
  });

  test("returns nothing for blank input", () => {
    expect(parseCsvList("  \n ")).toEqual([]);
    expect(parseCsvList("")).toEqual([]);
  });
});

test.describe("parseActionFieldType", () => {
  test("accepts every known type verbatim", () => {
    for (const type of Object.values(ActionFieldType)) {
      expect(parseActionFieldType(type)).toBe(type);
    }
  });

  test("falls back to PARAGRAPH for anything else", () => {
    for (const value of ["short", "Short", " SHORT", "", "TEXT", 42, null, undefined, {}, [], ["SHORT"], true]) {
      expect(parseActionFieldType(value), JSON.stringify(value)).toBe(ActionFieldType.PARAGRAPH);
    }
  });
});

test.describe("defaultActionFieldType", () => {
  test("canonical headers have a semantic type, user headers are paragraphs", () => {
    expect(defaultActionFieldType(ActionFieldHeaders.Description)).toBe(ActionFieldType.PARAGRAPH);
    expect(defaultActionFieldType(ActionFieldHeaders.Tag)).toBe(ActionFieldType.SHORT);
    expect(defaultActionFieldType("COST_EFFICIENCY")).toBe(ActionFieldType.PARAGRAPH);
    expect(defaultActionFieldType("Mitt eget fält")).toBe(ActionFieldType.PARAGRAPH);
    expect(defaultActionFieldType("")).toBe(ActionFieldType.PARAGRAPH);
  });

  test("a header named after an Object.prototype member is still a user header", () => {
    // `canonicalHeaderTypes` is a plain object, so `["toString"]` finds the
    // inherited function and `??` never reaches the PARAGRAPH fallback
    test.fail(true, "defaultActionFieldType leaks Object.prototype members (e.g. a header named 'toString' or 'constructor') instead of falling back to PARAGRAPH");
    for (const header of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(defaultActionFieldType(header), header).toBe(ActionFieldType.PARAGRAPH);
    }
  });
});

test.describe("groupActionFields", () => {
  const fields = [
    { header: "TAG", value: "a", type: ActionFieldType.SHORT },
    { header: "DESCRIPTION", value: "d", type: ActionFieldType.PARAGRAPH },
    { header: "TAG", value: "b", type: ActionFieldType.SHORT },
    { header: "Deadline", value: "2030-01-01", type: ActionFieldType.DATE },
    { header: "TAG", value: "c", type: ActionFieldType.DATE }, // the type of a later field is ignored
  ];

  test("groups by header in first-appearance order, taking the type from the first field", () => {
    expect(groupActionFields(fields)).toEqual([
      { header: "TAG", type: ActionFieldType.SHORT, values: ["a", "b", "c"] },
      { header: "DESCRIPTION", type: ActionFieldType.PARAGRAPH, values: ["d"] },
      { header: "Deadline", type: ActionFieldType.DATE, values: ["2030-01-01"] },
    ]);
  });

  test("headers are case-sensitive and an empty list groups to nothing", () => {
    expect(groupActionFields([{ header: "Tag", value: "x", type: ActionFieldType.SHORT }, { header: "TAG", value: "y", type: ActionFieldType.SHORT }])).toHaveLength(2);
    expect(groupActionFields([])).toEqual([]);
  });
});

test.describe("getActionFieldValue", () => {
  const fields = [
    { header: "TAG", value: "first" },
    { header: "DESCRIPTION", value: "the description" },
    { header: "TAG", value: "second" },
  ];

  test("returns the first value under the header", () => {
    expect(getActionFieldValue(fields, "TAG")).toBe("first");
    expect(getActionDescription(fields)).toBe("the description");
  });

  test("is undefined for unknown headers and missing field lists", () => {
    expect(getActionFieldValue(fields, "Missing")).toBeUndefined();
    expect(getActionFieldValue(fields, "tag")).toBeUndefined();
    expect(getActionFieldValue(undefined, "TAG")).toBeUndefined();
    expect(getActionFieldValue([], "TAG")).toBeUndefined();
    expect(getActionDescription(undefined)).toBeUndefined();
  });
});

test.describe("actionContentDiffers", () => {
  const origin = { name: "Cykelbanor", start_year: 2025, end_year: 2030, fields: [{ header: "TAG", value: "a" }, { header: "TAG", value: "b" }, { header: "ANSVARIG", value: "Kommunen" }] };

  test("identical content, or a copy missing origin-only headers, has not drifted", () => {
    expect(actionContentDiffers({ ...origin }, origin)).toBe(false);
    expect(actionContentDiffers({ ...origin, fields: [{ header: "TAG", value: "a" }, { header: "TAG", value: "b" }] }, origin)).toBe(false);
  });

  test("name, years, value order, extra values or copy-only headers are drift", () => {
    expect(actionContentDiffers({ ...origin, name: "Cykelbana" }, origin)).toBe(true);
    expect(actionContentDiffers({ ...origin, end_year: null }, origin)).toBe(true);
    expect(actionContentDiffers({ ...origin, fields: [{ header: "TAG", value: "b" }, { header: "TAG", value: "a" }] }, origin)).toBe(true);
    expect(actionContentDiffers({ ...origin, fields: [{ header: "TAG", value: "a" }] }, origin)).toBe(true);
    expect(actionContentDiffers({ ...origin, fields: [...origin.fields, { header: "NOTE", value: "x" }] }, origin)).toBe(true);
  });
});
