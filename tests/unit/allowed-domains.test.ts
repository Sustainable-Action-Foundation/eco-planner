import { expect, test } from "playwright/test";

import * as allowedDomainsModule from "../../src/lib/allowedDomains";
import { allowedDomains, orgDomainAliases } from "../../src/lib/allowedDomains";

/*
 * Shape lint for the signup allowlist: the list must be clean enough to compare
 * against a lowercased email domain, and every alias must enroll into an org
 * that signup can actually create (a listed canonical domain).
 */

test.describe("allowedDomains", () => {
  test("is a non-empty list of bare, lowercase domains", () => {
    expect(allowedDomains.length).toBeGreaterThan(0);
    for (const domain of allowedDomains) {
      expect(domain, domain).toMatch(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/);
      expect(domain, domain).toBe(domain.trim().toLowerCase());
      expect(domain, domain).not.toContain("@");
    }
  });

  test("has no duplicates", () => {
    expect(new Set(allowedDomains).size).toBe(allowedDomains.length);
  });
});

test.describe("orgDomainAliases", () => {
  test("every alias is an allowed signup domain", () => {
    for (const alias of Object.keys(orgDomainAliases)) {
      expect(allowedDomains, `alias ${alias}`).toContain(alias);
    }
  });

  test("every alias points at a listed canonical domain", () => {
    for (const [alias, canonical] of Object.entries(orgDomainAliases)) {
      expect(allowedDomains, `${alias} -> ${canonical}`).toContain(canonical);
    }
  });

  test("aliases do not point at themselves or chain into other aliases", () => {
    for (const [alias, canonical] of Object.entries(orgDomainAliases)) {
      expect(canonical, alias).not.toBe(alias);
      expect(Object.keys(orgDomainAliases), `${alias} -> ${canonical} is itself an alias`).not.toContain(canonical);
    }
  });

  test("the SAF alias lands in the .ngo org", () => {
    expect(orgDomainAliases["sustainable-action.org"]).toBe("sustainable-action.ngo");
  });

  test("the module exports nothing but the list and the alias map", () => {
    // No lookup helpers exist today; if one is added it needs tests here
    expect(Object.keys(allowedDomainsModule).sort()).toEqual(["allowedDomains", "orgDomainAliases"]);
  });
});
