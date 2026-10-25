import { expect, test } from "playwright/test";
import { displayName, nameMaxLength, normalizeName } from "@/functions/personName";

test.describe("displayName", () => {
  test("joins first and last name, falling back to the username", () => {
    expect(displayName({ first_name: "Karin", last_name: "Lind", username: "karin.lind" })).toBe("Karin Lind");
    expect(displayName({ first_name: null, last_name: null, username: "karin.lind" })).toBe("karin.lind");
    expect(displayName({ username: "karin.lind" })).toBe("karin.lind");
    // A half-filled name still shows what there is rather than the username
    expect(displayName({ first_name: "Karin", last_name: "  ", username: "karin.lind" })).toBe("Karin");
  });
});

test.describe("normalizeName", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeName("  Maja   Lisa ")).toBe("Maja Lisa");
    expect(normalizeName("Sandberg\n")).toBe("Sandberg");
  });

  test("rejects empties, non-strings, control characters and overlong names", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName(5)).toBeNull();
    expect(normalizeName(undefined)).toBeNull();
    expect(normalizeName("Ctrl\u0007")).toBeNull();
    expect(normalizeName("x".repeat(nameMaxLength))).toHaveLength(nameMaxLength);
    expect(normalizeName("x".repeat(nameMaxLength + 1))).toBeNull();
  });

  test("keeps letters from any script", () => {
    expect(normalizeName("Nyström")).toBe("Nyström");
    expect(normalizeName("Åsa-Britt")).toBe("Åsa-Britt");
    expect(normalizeName("Amina Hassan")).toBe("Amina Hassan");
  });
});
