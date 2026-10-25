import { expect, test } from "playwright/test";

import { hashToken, loginTokenTtlMs, looksLikeEmail, mintToken } from "../../src/lib/authToken";
import { isAllowedDomain, isValidDomain, orgDomainCandidates } from "../../src/functions/enrollment";
import { deriveUsername, isValidUsername, usernameMaxLength } from "../../src/functions/username";
import { allowedDomains, orgDomainAliases } from "../../src/lib/allowedDomains";

/*
 * The pure parts of passwordless login: token minting/hashing, the domain gate shared
 * by signup and link redemption, and the username derived for link-created accounts.
 */

test.describe("login tokens", () => {
  test("a minted token is 32 random bytes as base64url and its hash is sha256 hex", () => {
    const { token, hash } = mintToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
  });

  test("two tokens differ and hashing is deterministic", () => {
    const a = mintToken();
    const b = mintToken();
    expect(a.token).not.toBe(b.token);
    expect(hashToken("fixed")).toBe(hashToken("fixed"));
    expect(hashToken("fixed")).not.toBe(hashToken("fixed2"));
  });

  test("the TTL is 15 minutes", () => {
    expect(loginTokenTtlMs).toBe(15 * 60 * 1000);
  });

  test("looksLikeEmail accepts addresses and rejects junk", () => {
    for (const ok of ["a@b.se", "first.last@sub.example.com", '"quoted"@x.io']) {
      expect(looksLikeEmail(ok), ok).toBe(true);
    }
    for (const bad of ["", "a", "a@", "@b.se", "a@b", "a b@c.se", "a@b c.se"]) {
      expect(looksLikeEmail(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

test.describe("domain enrollment", () => {
  test("isValidDomain follows the RFC shape", () => {
    expect(isValidDomain("boden.se")).toBe(true);
    expect(isValidDomain("a.b-c.d")).toBe(true);
    for (const bad of [null, undefined, "", "-x.se", "x-.se", "x..se", "x.se>", "x se"]) {
      expect(isValidDomain(bad), String(bad)).toBe(false);
    }
  });

  test("isAllowedDomain matches listed domains and their subdomains only", () => {
    const listed = allowedDomains[0];
    expect(isAllowedDomain(listed)).toBe(true);
    expect(isAllowedDomain(`mail.${listed}`)).toBe(true);
    expect(isAllowedDomain(`not${listed}`), "a suffix match is not a subdomain").toBe(false);
    expect(isAllowedDomain("example.com")).toBe(false);
  });

  test("orgDomainCandidates lists the domain and its parents, most specific first, aliases resolved", () => {
    expect(orgDomainCandidates("stadshuset.goteborg.se")).toEqual(["stadshuset.goteborg.se", "goteborg.se", "se"]);
    const [alias, canonical] = Object.entries(orgDomainAliases)[0] ?? [];
    if (alias && canonical) {
      expect(orgDomainCandidates(alias)[0]).toBe(canonical);
    }
  });
});

test.describe("deriveUsername", () => {
  test("is the local part when it is already a valid username", () => {
    expect(deriveUsername("maja.sandberg@boden.se")).toBe("maja.sandberg");
    expect(deriveUsername("Ola_Nordmann-2@boden.se")).toBe("Ola_Nordmann-2");
  });

  test("folds disallowed characters and trims punctuation at the ends", () => {
    expect(deriveUsername("john+tag@boden.se")).toBe("john-tag");
    expect(deriveUsername("'o.neil'@boden.se")).toBe("o.neil");
    expect(deriveUsername('"john doe"@boden.se')).toBe("john-doe");
  });

  test("always yields a valid username, padded or truncated as needed", () => {
    expect(deriveUsername("a@boden.se")).toBe("a-user");
    expect(deriveUsername("+@boden.se")).toBe("user");
    const long = deriveUsername(`${"x".repeat(usernameMaxLength + 20)}@boden.se`);
    expect([...long]).toHaveLength(usernameMaxLength);
    for (const email of ["a@b.se", "+@b.se", "x.y_z-w@b.se", "åsa.öberg@b.se", "a b@b.se", `${"x".repeat(200)}@b.se`]) {
      expect(isValidUsername(deriveUsername(email)), email).toBe(true);
    }
  });
});
