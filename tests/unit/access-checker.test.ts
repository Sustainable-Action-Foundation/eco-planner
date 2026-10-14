import { expect, test } from "playwright/test";

import accessChecker, { hasAdminAccess, hasCommentAccess, hasEditAccess, hasViewAccess } from "../../src/lib/accessChecker";
import { IterationStatus } from "../../src/lib/prisma/generated";
import { AccessLevel } from "../../src/types/enums";
import { accessControls, contexts, type AccessControlName, type ContextName } from "../lib/access-contexts";

/*
 * The access ladder, rung by rung:
 *   super admin > manager of the owning org > RW grant > RO grant / ORG sharing (non-guests) / PUBLIC > nothing
 * Drafts additionally hide everything below Edit. Authorship never counts.
 */

const { None, View, Edit, Admin } = AccessLevel;

/** Expected level per (context, access control) on a published item or a roadmap itself */
const ladder: Record<ContextName, Record<AccessControlName, AccessLevel>> = {
  //                 public      public+grants  org        org+grants  groups     groups+grants
  anonymous: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: None, groupsNoGrants: None, groupsWithGrants: None },
  orgless: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: None, groupsNoGrants: None, groupsWithGrants: None },
  foreignMember: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: None, groupsNoGrants: None, groupsWithGrants: None },
  foreignManager: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: None, groupsNoGrants: None, groupsWithGrants: None },
  // Guests only see what their groups grant, plus public content: ORG sharing does not include them
  guest: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: None, groupsNoGrants: None, groupsWithGrants: None },
  guestRO: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: None, orgWithGrants: View, groupsNoGrants: None, groupsWithGrants: View },
  guestRW: { publicNoGrants: View, publicWithGrants: Edit, orgNoGrants: None, orgWithGrants: Edit, groupsNoGrants: None, groupsWithGrants: Edit },
  // Members read ORG-shared content; GROUPS sharing needs a grant
  member: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: View, orgWithGrants: View, groupsNoGrants: None, groupsWithGrants: None },
  memberIdleGroup: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: View, orgWithGrants: View, groupsNoGrants: None, groupsWithGrants: None },
  memberRO: { publicNoGrants: View, publicWithGrants: View, orgNoGrants: View, orgWithGrants: View, groupsNoGrants: None, groupsWithGrants: View },
  memberRW: { publicNoGrants: View, publicWithGrants: Edit, orgNoGrants: View, orgWithGrants: Edit, groupsNoGrants: None, groupsWithGrants: Edit },
  // Managers and super admins administer everything of the org / everywhere
  manager: { publicNoGrants: Admin, publicWithGrants: Admin, orgNoGrants: Admin, orgWithGrants: Admin, groupsNoGrants: Admin, groupsWithGrants: Admin },
  superAdmin: { publicNoGrants: Admin, publicWithGrants: Admin, orgNoGrants: Admin, orgWithGrants: Admin, groupsNoGrants: Admin, groupsWithGrants: Admin },
  superAdminGuest: { publicNoGrants: Admin, publicWithGrants: Admin, orgNoGrants: Admin, orgWithGrants: Admin, groupsNoGrants: Admin, groupsWithGrants: Admin },
};

const contextNames = Object.keys(contexts) as ContextName[];
const accessControlNames = Object.keys(accessControls) as AccessControlName[];

test.describe("accessChecker ladder", () => {
  for (const contextName of contextNames) {
    test(`${contextName}: published items`, () => {
      for (const acName of accessControlNames) {
        const expected = ladder[contextName][acName];
        expect(accessChecker({ access_control: accessControls[acName] }, contexts[contextName]), `${contextName} on ${acName} (no status)`).toBe(expected);
        expect(accessChecker({ access_control: accessControls[acName], status: IterationStatus.PUBLISHED }, contexts[contextName]), `${contextName} on ${acName} (PUBLISHED)`).toBe(expected);
      }
    });

    test(`${contextName}: drafts are hidden below edit access`, () => {
      for (const acName of accessControlNames) {
        const published = ladder[contextName][acName];
        const expected = hasEditAccess(published) ? published : None;
        expect(accessChecker({ access_control: accessControls[acName], status: IterationStatus.DRAFT }, contexts[contextName]), `${contextName} on ${acName} (DRAFT)`).toBe(expected);
      }
    });
  }

  test("the ladder table itself is complete and only steps down for drafts", () => {
    // Sanity on the fixture: a draft never reveals more than the published item
    for (const contextName of contextNames) {
      for (const acName of accessControlNames) {
        const draft = accessChecker({ access_control: accessControls[acName], status: IterationStatus.DRAFT }, contexts[contextName]);
        const published = accessChecker({ access_control: accessControls[acName] }, contexts[contextName]);
        expect(hasViewAccess(draft) && !hasViewAccess(published)).toBe(false);
      }
    }
  });
});

test.describe("accessChecker edge cases", () => {
  test("a missing item is no access for everyone", () => {
    for (const contextName of contextNames) {
      expect(accessChecker(null, contexts[contextName]), `${contextName} null`).toBe(None);
      expect(accessChecker(undefined, contexts[contextName]), `${contextName} undefined`).toBe(None);
    }
  });

  test("an undefined user is treated like an anonymous one", () => {
    for (const acName of accessControlNames) {
      expect(accessChecker({ access_control: accessControls[acName] }, undefined)).toBe(ladder.anonymous[acName]);
    }
  });

  test("super admin wins even with a GUEST membership in the org", () => {
    expect(accessChecker({ access_control: accessControls.groupsNoGrants, status: IterationStatus.DRAFT }, contexts.superAdminGuest)).toBe(Admin);
  });

  test("an RW grant never reaches admin; a manager never needs a grant", () => {
    expect(hasAdminAccess(accessChecker({ access_control: accessControls.groupsWithGrants }, contexts.memberRW))).toBe(false);
    expect(hasAdminAccess(accessChecker({ access_control: accessControls.groupsNoGrants }, contexts.manager))).toBe(true);
  });

  test("the highest grant among the user's groups wins", () => {
    // memberRW is in both the RO and the RW group
    expect(accessChecker({ access_control: accessControls.orgWithGrants }, contexts.memberRW)).toBe(Edit);
  });

  test("grants are matched by group id, so other orgs' memberships do not help", () => {
    // foreignMember has no groups at all; give them the RW group id under the other org
    const impostor = { ...contexts.foreignMember, memberships: [{ orgId: "other-org-id", role: "MEMBER" as const, groupIds: ["group-rw"] }] };
    // Grants only reference groups of the owning org (composite FK), so a matching id implies the same org.
    // The checker therefore trusts the id: this documents that the FK, not the checker, is the barrier.
    expect(accessChecker({ access_control: accessControls.groupsWithGrants }, impostor)).toBe(Edit);
  });
});

test.describe("level predicates", () => {
  test("hasAdminAccess is Admin only", () => {
    expect(hasAdminAccess(Admin)).toBe(true);
    expect(hasAdminAccess(Edit)).toBe(false);
    expect(hasAdminAccess(View)).toBe(false);
    expect(hasAdminAccess(None)).toBe(false);
  });

  test("hasEditAccess is Edit or Admin", () => {
    expect(hasEditAccess(Admin)).toBe(true);
    expect(hasEditAccess(Edit)).toBe(true);
    expect(hasEditAccess(View)).toBe(false);
    expect(hasEditAccess(None)).toBe(false);
  });

  test("hasViewAccess is anything but None", () => {
    expect(hasViewAccess(Admin)).toBe(true);
    expect(hasViewAccess(Edit)).toBe(true);
    expect(hasViewAccess(View)).toBe(true);
    expect(hasViewAccess(None)).toBe(false);
  });

  test("commenting needs view access and a signed-in user", () => {
    expect(hasCommentAccess(View, contexts.orgless)).toBe(true);
    expect(hasCommentAccess(Edit, contexts.member)).toBe(true);
    expect(hasCommentAccess(Admin, contexts.manager)).toBe(true);
    expect(hasCommentAccess(None, contexts.member)).toBe(false);
    expect(hasCommentAccess(View, null)).toBe(false);
    expect(hasCommentAccess(Admin, undefined)).toBe(false);
  });

  test("an orgless user can comment on public content but not on org content", () => {
    expect(hasCommentAccess(accessChecker({ access_control: accessControls.publicNoGrants }, contexts.orgless), contexts.orgless)).toBe(true);
    expect(hasCommentAccess(accessChecker({ access_control: accessControls.orgNoGrants }, contexts.orgless), contexts.orgless)).toBe(false);
  });
});
