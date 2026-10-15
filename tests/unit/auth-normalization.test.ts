import { expect, test } from "playwright/test";

import { emailDomain, normalizeEmail } from "../../src/functions/email";
import { normalizeUsername, usernameKey } from "../../src/functions/username";

/*
 * The canonical forms the auth routes key on. Every handler normalizes on entry,
 * so these decide whether two spellings of an address or a handle are the same user.
 */

test.describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Name@Boden.SE \n")).toBe("name@boden.se");
  });

  test("unwraps a display-name envelope", () => {
    expect(normalizeEmail("John Doe <John.Doe@Example.com>")).toBe("john.doe@example.com");
    expect(normalizeEmail("<x@y.z>")).toBe("x@y.z");
  });

  test("leaves a quoted local part alone apart from case", () => {
    expect(normalizeEmail('"john@doe"@Example.com')).toBe('"john@doe"@example.com');
  });

  test("is idempotent", () => {
    for (const raw of ["a@b.c", " A@B.C ", "N <a@b.c>"]) {
      const once = normalizeEmail(raw);
      expect(normalizeEmail(once), raw).toBe(once);
    }
  });
});

test.describe("emailDomain", () => {
  test("is the part after the last @", () => {
    expect(emailDomain("name@boden.se")).toBe("boden.se");
    expect(emailDomain('"john@doe"@example.com')).toBe("example.com");
  });

  test("is null without an @", () => {
    expect(emailDomain("not-an-address")).toBeNull();
  });
});

test.describe("username normalization", () => {
  test("the stored form keeps casing but drops surrounding whitespace", () => {
    expect(normalizeUsername("  VenaStrom ")).toBe("VenaStrom");
  });

  test("the lookup key is case-folded", () => {
    expect(usernameKey(" Anita")).toBe("anita");
    expect(usernameKey("anita")).toBe(usernameKey("ANITA"));
    expect(usernameKey("Ängsö")).toBe("ängsö");
  });
});
