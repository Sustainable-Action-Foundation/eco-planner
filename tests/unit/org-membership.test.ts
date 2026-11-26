import { expect, test } from "playwright/test";

import { assignableRole, browsesAllUsers, leavesOrgWithoutManager, managesMembers, movedRole, movesMember, removesMember } from "../../src/functions/orgMembership";
import { OrgRole } from "../../src/lib/prisma/generated";
import type { UserAccessContext } from "../../src/types";
import { contexts, ORG, OTHER_ORG, type ContextName } from "../lib/access-contexts";

/*
 * The rules behind adding, removing and moving org members (/api/org-membership
 * POST, DELETE, PATCH): who may do what, which roles can be given, and when an org
 * is left without a manager.
 */

const contextNames = Object.keys(contexts) as ContextName[];
/** Managers of ORG and super admins decide over ORG's members; a manager of another org does not */
const deciders: ContextName[] = ["manager", "superAdmin", "superAdminGuest"];
const superAdmins: ContextName[] = ["superAdmin", "superAdminGuest"];

/** A manager of both orgs, which the shared fixtures have no use for */
const managerOfBoth: UserAccessContext = {
  id: "manager-of-both",
  username: "manager-of-both",
  isSuperAdmin: false,
  memberships: [{ orgId: ORG, role: OrgRole.MANAGER, groupIds: [] }, { orgId: OTHER_ORG, role: OrgRole.MANAGER, groupIds: [] }],
};
/** Manages ORG, plain member of the other org */
const managerHereMemberThere: UserAccessContext = {
  ...managerOfBoth,
  memberships: [{ orgId: ORG, role: OrgRole.MANAGER, groupIds: [] }, { orgId: OTHER_ORG, role: OrgRole.MEMBER, groupIds: [] }],
};

test.describe("who may change an org's members", () => {
  for (const name of contextNames) {
    const decides = deciders.includes(name);
    const superAdmin = superAdmins.includes(name);

    test(`${name}: add ${decides ? "yes" : "no"}, remove ${decides ? "yes" : "no"}, user list ${superAdmin ? "yes" : "no"}, move elsewhere ${superAdmin ? "yes" : "no"}`, () => {
      const context = contexts[name];
      expect(managesMembers(context, ORG), "add to the org").toBe(decides);
      expect(removesMember(context, ORG, false), "remove someone else").toBe(decides);
      // The list of every user and address is the super admin's alone
      expect(browsesAllUsers(context), "see every user").toBe(superAdmin);
      // None of the fixtures manages the other org too, so only super admins move there
      expect(movesMember(context, ORG, OTHER_ORG, false), "move to an org they do not manage").toBe(superAdmin);
    });
  }

  test("a manager may not remove or move themselves; a super admin may", () => {
    expect(removesMember(contexts.manager, ORG, true)).toBe(false);
    expect(movesMember(managerOfBoth, ORG, OTHER_ORG, true)).toBe(false);
    expect(removesMember(contexts.superAdmin, ORG, true)).toBe(true);
    expect(movesMember(contexts.superAdmin, ORG, OTHER_ORG, true)).toBe(true);
  });

  test("a manager moves a member only between orgs they manage", () => {
    expect(movesMember(managerOfBoth, ORG, OTHER_ORG, false), "manages both").toBe(true);
    expect(movesMember(managerOfBoth, OTHER_ORG, ORG, false), "manages both, the other way").toBe(true);
    expect(movesMember(managerHereMemberThere, ORG, OTHER_ORG, false), "only a member of the target").toBe(false);
    expect(movesMember(managerHereMemberThere, OTHER_ORG, ORG, false), "only a member of the source").toBe(false);
    expect(movesMember(contexts.foreignManager, ORG, OTHER_ORG, false), "manages the target only").toBe(false);
    expect(movesMember(contexts.manager, ORG, "a-third-org", false), "an org they have nothing to do with").toBe(false);
  });

  test("a manager of another org decides nothing here", () => {
    expect(managesMembers(contexts.foreignManager, ORG)).toBe(false);
    expect(removesMember(contexts.foreignManager, ORG, false)).toBe(false);
    expect(managesMembers(contexts.foreignManager, OTHER_ORG)).toBe(true);
  });

  test("a super admin with suspended powers is whatever their memberships make them", () => {
    // `isSuperAdmin` in the access context is the effective value: false while suspended
    const suspended = { ...contexts.superAdmin, isSuperAdmin: false };
    expect(managesMembers(suspended, ORG)).toBe(false);
    expect(browsesAllUsers(suspended)).toBe(false);
    // One who also manages the org keeps the manager's part, and its lock on themselves
    const suspendedManager = { ...contexts.manager, isSuperAdmin: false };
    expect(managesMembers(suspendedManager, ORG)).toBe(true);
    expect(browsesAllUsers(suspendedManager)).toBe(false);
    expect(removesMember(suspendedManager, ORG, true)).toBe(false);
  });

  test("no context at all may nothing", () => {
    expect(managesMembers(undefined, ORG)).toBe(false);
    expect(browsesAllUsers(null)).toBe(false);
    expect(removesMember(null, ORG, false)).toBe(false);
    expect(movesMember(undefined, ORG, OTHER_ORG, false)).toBe(false);
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
