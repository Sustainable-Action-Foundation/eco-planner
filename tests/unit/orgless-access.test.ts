import { expect, test } from "playwright/test";

import accessChecker, { hasCommentAccess, hasEditAccess, hasViewAccess } from "../../src/lib/accessChecker";
import { AccessLevel } from "../../src/types/enums";
import { AccessLevel as GrantLevel, IterationStatus, OrgRole, Sharing } from "../../src/lib/prisma/generated";
import type { AccessControlInfo, UserAccessContext } from "../../src/types";

/**
 * An orgless user (verified account, zero org memberships) must never gain
 * edit access to anything: every create/edit path in the app bottoms out in
 * accessChecker or a membership check, so this pins the accessChecker half.
 * The seeded `orgless`/`orgless` user exercises the same invariant in the UI.
 */

const orgless: UserAccessContext = {
  id: "orgless-id",
  username: "orgless",
  isSuperAdmin: false,
  memberships: [],
};

function accessControl(overrides?: Partial<AccessControlInfo>): AccessControlInfo {
  return {
    id: "ac-id",
    org_id: "org-id",
    org: { name: "Org" },
    sharing: Sharing.ORG,
    grants: [],
    ...overrides,
  };
}

test.describe("Orgless users cannot create or edit anything", () => {
  test("public content is view-only", () => {
    const level = accessChecker({ access_control: accessControl({ sharing: Sharing.PUBLIC }) }, orgless);
    expect(level).toBe(AccessLevel.View);
    expect(hasEditAccess(level)).toBe(false);
  });

  test("org-readable content is invisible without a membership", () => {
    const level = accessChecker({ access_control: accessControl({ sharing: Sharing.ORG }) }, orgless);
    expect(level).toBe(AccessLevel.None);
  });

  test("grants to groups the user is not in count for nothing", () => {
    const level = accessChecker({
      access_control: accessControl({
        grants: [
          { group_id: "group-a", access_level: GrantLevel.RW },
          { group_id: "group-b", access_level: GrantLevel.RO },
        ],
      }),
    }, orgless);
    expect(level).toBe(AccessLevel.None);
  });

  test("drafts stay hidden even when public", () => {
    const level = accessChecker({
      access_control: accessControl({ sharing: Sharing.PUBLIC }),
      status: IterationStatus.DRAFT,
    }, orgless);
    expect(level).toBe(AccessLevel.None);
  });

  test("commenting on public content still works (view + signed in)", () => {
    const level = accessChecker({ access_control: accessControl({ sharing: Sharing.PUBLIC }) }, orgless);
    expect(hasCommentAccess(level, orgless)).toBe(true);
  });

  test("the sidebar's can-create predicate is false for orgless users", () => {
    // Mirrors the gate in sidebar.tsx / getOrgOptions: creating requires a
    // non-guest membership (or super admin)
    const canCreate = orgless.isSuperAdmin
      || orgless.memberships.some(membership => membership.role !== OrgRole.GUEST);
    expect(canCreate).toBe(false);
  });
});

test.describe("The same checks still pass for members (ladder sanity)", () => {
  const member: UserAccessContext = {
    id: "member-id",
    username: "member",
    isSuperAdmin: false,
    memberships: [{ orgId: "org-id", role: OrgRole.MEMBER, groupIds: ["group-a"] }],
  };

  test("org-readable content is viewable for members", () => {
    const level = accessChecker({ access_control: accessControl() }, member);
    expect(level).toBe(AccessLevel.View);
    expect(hasViewAccess(level)).toBe(true);
    expect(hasEditAccess(level)).toBe(false);
  });

  test("an RW grant via the user's group means edit access", () => {
    const level = accessChecker({
      access_control: accessControl({ grants: [{ group_id: "group-a", access_level: GrantLevel.RW }] }),
    }, member);
    expect(level).toBe(AccessLevel.Edit);
  });

  test("managers get admin on their org's content", () => {
    const manager: UserAccessContext = { ...member, memberships: [{ orgId: "org-id", role: OrgRole.MANAGER, groupIds: [] }] };
    const level = accessChecker({ access_control: accessControl() }, manager);
    expect(level).toBe(AccessLevel.Admin);
  });
});
