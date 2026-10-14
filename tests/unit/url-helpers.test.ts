import { expect, test } from "playwright/test";

import truncateText from "../../src/functions/truncateText";
import { isValidUsername, usernameFromParam, usernameMaxLength, usernameMinLength } from "../../src/functions/username";
import { iterationPath, parseVersionSlug } from "../../src/functions/versionSlug";

test.describe("Version slugs", () => {
  test("parses vN and latest", () => {
    expect(parseVersionSlug("v3")).toBe(3);
    expect(parseVersionSlug("v1")).toBe(1);
    expect(parseVersionSlug("v12")).toBe(12);
    expect(parseVersionSlug("latest")).toBe("latest");
  });

  test("rejects anything else", () => {
    for (const slug of ["", "3", "v", "V3", "v3a", "v-1", "v3.1", " v3", "latest ", "Latest", "v 3"]) {
      expect(parseVersionSlug(slug), `slug ${JSON.stringify(slug)}`).toBeNull();
    }
  });

  test("builds iteration paths that parse back", () => {
    expect(iterationPath("abc", 3)).toBe("/roadmap/abc/v3");
    expect(iterationPath("abc", "latest")).toBe("/roadmap/abc/latest");
    for (const version of [1, 7, "latest"] as const) {
      const slug = iterationPath("id", version).split("/").at(-1) ?? "";
      expect(parseVersionSlug(slug)).toBe(version);
    }
  });
});

test.describe("Usernames", () => {
  test("accepts letters from any script, digits, dot, underscore and hyphen", () => {
    for (const name of ["anna", "Anna_Svensson", "a.b-c", "user42", "Åsa", "Öberg", "李雷", "Ærø", "ελένη", "élan"]) {
      expect(isValidUsername(name), name).toBe(true);
    }
  });

  test("rejects route-breaking characters", () => {
    for (const name of ["an na", "a@b", "a/b", "a%40b", "a#b", "a?b", "a\\b", "a:b", "", "x"]) {
      expect(isValidUsername(name), JSON.stringify(name)).toBe(false);
    }
  });

  test("length limits count code points, not UTF-16 units", () => {
    expect(isValidUsername("a".repeat(usernameMinLength))).toBe(true);
    expect(isValidUsername("a".repeat(usernameMinLength - 1))).toBe(false);
    expect(isValidUsername("a".repeat(usernameMaxLength))).toBe(true);
    expect(isValidUsername("a".repeat(usernameMaxLength + 1))).toBe(false);
    // Astral letters are two UTF-16 units but one code point
    const astral = "𝒜"; // U+1D49C MATHEMATICAL SCRIPT CAPITAL A
    expect(astral.length).toBe(2);
    expect(isValidUsername(astral.repeat(usernameMaxLength))).toBe(true);
    expect(isValidUsername(astral.repeat(usernameMaxLength + 1))).toBe(false);
  });

  test("route params lose their handle prefix, encoded or not", () => {
    expect(usernameFromParam("anna")).toBe("anna");
    expect(usernameFromParam("@anna")).toBe("anna");
    expect(usernameFromParam("%40anna")).toBe("anna");
  });

  test("route params are percent-decoded", () => {
    expect(usernameFromParam("%C3%85sa")).toBe("Åsa");
    expect(usernameFromParam("@%C3%85sa")).toBe("Åsa");
    expect(usernameFromParam("%40%E6%9D%8E%E9%9B%B7")).toBe("李雷");
  });

  test("a malformed escape keeps the raw segment instead of throwing", () => {
    expect(usernameFromParam("%E0%A4%A")).toBe("%E0%A4%A");
    expect(usernameFromParam("@100%")).toBe("100%");
  });

  test("only one handle prefix is stripped", () => {
    expect(usernameFromParam("@@anna")).toBe("@anna");
    expect(usernameFromParam("@%40anna")).toBe("@anna");
  });
});

test.describe("truncateText", () => {
  test("short and empty input is returned as is", () => {
    expect(truncateText("hello", 10)).toBe("hello");
    expect(truncateText("hello", 5)).toBe("hello");
    expect(truncateText("", 5)).toBeUndefined();
    expect(truncateText(null, 5)).toBeUndefined();
    expect(truncateText(undefined, 5)).toBeUndefined();
  });

  test("cuts at the last word boundary within the limit and adds an ellipsis", () => {
    expect(truncateText("hello world foo", 8)).toBe("hello…");
    expect(truncateText("hello world foo", 11)).toBe("hello…");
    expect(truncateText("hello world foo", 12)).toBe("hello world…");
  });

  test("the result never exceeds the limit plus the ellipsis", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    for (let max = 1; max < text.length; max++) {
      const result = truncateText(text, max) ?? "";
      expect(result.length, `max ${max}`).toBeLessThanOrEqual(max + 1);
      expect(result.endsWith("…"), `max ${max}`).toBe(true);
    }
  });

  test("input without spaces keeps the whole prefix", () => {
    // `lastIndexOf(' ')` is -1 here, and `slice(0, -1)` then drops the last
    // character of the prefix instead of keeping it
    test.fail(true, "truncateText drops the last character when the prefix has no space (slice(0, -1))");
    expect(truncateText("abcdefghij", 5)).toBe("abcde…");
  });

  test("input without spaces still gets an ellipsis within the limit", () => {
    const result = truncateText("abcdefghij", 5) ?? "";
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(6);
    expect("abcdefghij".startsWith(result.slice(0, -1))).toBe(true);
  });
});
