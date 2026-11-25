import { expect, test } from "playwright/test";

import { administersMembers, assignableRole, leavesOrgWithoutManager, movedRole } from "../../src/functions/orgMembership";
import { OrgRole } from "../../src/lib/prisma/generated";
import { contexts, ORG, type ContextName } from "../lib/access-contexts";

/*
 * The rules behind adding, removing and moving org members (/api/org-membership
 * POST, DELETE, PATCH): who may, which roles can be given, and when an org is left
 * without a manager.
 */

test.describe("administersMembers", () => {
  // Super admins only; managing the org is not enough (managers change roles, nothing more)
  const allowed: ContextName[] = ["superAdmin", "superAdminGuest"];

  for (const name of Object.keys(contexts) as ContextName[]) {
    test(`${name}: ${allowed.includes(name) ? "may" : "may not"}`, () => {
      expect(administersMembers(contexts[name], ORG)).toBe(allowed.includes(name));
    });
  }

  test("a super admin with suspended powers is whatever their memberships make them", () => {
    // `isSuperAdmin` in the access context is the effective value: false while suspended
    expect(administersMembers({ ...contexts.superAdmin, isSuperAdmin: false }, ORG)).toBe(false);
    expect(administersMembers({ ...contexts.manager, isSuperAdmin: false }, ORG)).toBe(false);
  });

  test("no context at all may not", () => {
    expect(administersMembers(undefined, ORG)).toBe(false);
  });
});

test.describe("assignableRole", () => {
  test("MEMBER and MANAGER are the roles that can be given", () => {
    expect(assignableRole("MEMBER")).toBe(OrgRole.MEMBER);
    expect(assignableRole("MANAGER")).toBe(OrgRole.MANAGER);
  });

  test("GUEST and anything else is refused", () => {
    for (const value of ["GUEST", "OWNER", "member", "", null, undefined, 1, {}, ["MANAGER"]]) {
      expect(assignableRole(value), JSON.stringify(value)).toBeNull();
    }
  });
});

test.describe("movedRole", () => {
  test("the role comes along when none is asked for", () => {
    expect(movedRole(undefined, OrgRole.MEMBER)).toBe(OrgRole.MEMBER);
    expect(movedRole(undefined, OrgRole.MANAGER)).toBe(OrgRole.MANAGER);
  });

  test("an asked-for role wins", () => {
    expect(movedRole("MEMBER", OrgRole.MANAGER)).toBe(OrgRole.MEMBER);
    expect(movedRole("MANAGER", OrgRole.MEMBER)).toBe(OrgRole.MANAGER);
  });

  test("a guest moves as a plain member, and a bad request falls back to the current role", () => {
    expect(movedRole(undefined, OrgRole.GUEST)).toBe(OrgRole.MEMBER);
    expect(movedRole("GUEST", OrgRole.MANAGER)).toBe(OrgRole.MANAGER);
  });
});

test.describe("leavesOrgWithoutManager", () => {
  const member = (membershipId: string, role: OrgRole) => ({ membershipId, role });

  test("the only manager of an org with other members", () => {
    const members = [member("a", OrgRole.MANAGER), member("b", OrgRole.MEMBER)];
    expect(leavesOrgWithoutManager(members, "a")).toBe(true);
    expect(leavesOrgWithoutManager(members, "b")).toBe(false);
  });

  test("one of several managers", () => {
    const members = [member("a", OrgRole.MANAGER), member("b", OrgRole.MANAGER), member("c", OrgRole.MEMBER)];
    expect(leavesOrgWithoutManager(members, "a")).toBe(false);
  });

  test("the last member of all leaves nobody to manage", () => {
    expect(leavesOrgWithoutManager([member("a", OrgRole.MANAGER)], "a")).toBe(false);
  });

  test("guests are nobody to manage: they are disabled", () => {
    expect(leavesOrgWithoutManager([member("a", OrgRole.MANAGER), member("g", OrgRole.GUEST)], "a")).toBe(false);
  });

  test("an unknown membership", () => {
    expect(leavesOrgWithoutManager([member("a", OrgRole.MANAGER), member("b", OrgRole.MEMBER)], "x")).toBe(false);
  });
});
