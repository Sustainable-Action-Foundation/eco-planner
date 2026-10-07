import { AccessLevel as GrantLevel, OrgRole, Sharing } from "../../src/lib/prisma/generated";
import type { AccessControlInfo, UserAccessContext } from "../../src/types";

/*
 * Shared fixtures for the access ladder: one access control owned by ORG, a
 * set of user contexts covering every rung, and the grant/sharing variants.
 * Used by access-checker.test.ts (the verdicts) and access-filters.test.ts
 * (the Prisma WHERE mirror), so the two are checked against the same world.
 */

export const ORG = "org-id";
export const OTHER_ORG = "other-org-id";
/** A group in ORG that carries an RO grant on the item (when grants are present) */
export const RO_GROUP = "group-ro";
/** A group in ORG that carries an RW grant on the item (when grants are present) */
export const RW_GROUP = "group-rw";
/** A group in ORG with no grants on the item */
export const IDLE_GROUP = "group-idle";

function context(id: string, memberships: UserAccessContext["memberships"], isSuperAdmin = false): UserAccessContext {
  return { id, username: id, isSuperAdmin, memberships };
}

/** Every rung of the ladder, named by what the user is to ORG. `anonymous` is a null context. */
export const contexts = {
  anonymous: null,
  orgless: context("orgless", []),
  foreignMember: context("foreign-member", [{ orgId: OTHER_ORG, role: OrgRole.MEMBER, groupIds: [] }]),
  foreignManager: context("foreign-manager", [{ orgId: OTHER_ORG, role: OrgRole.MANAGER, groupIds: [] }]),
  guest: context("guest", [{ orgId: ORG, role: OrgRole.GUEST, groupIds: [] }]),
  guestRO: context("guest-ro", [{ orgId: ORG, role: OrgRole.GUEST, groupIds: [RO_GROUP] }]),
  guestRW: context("guest-rw", [{ orgId: ORG, role: OrgRole.GUEST, groupIds: [RW_GROUP] }]),
  member: context("member", [{ orgId: ORG, role: OrgRole.MEMBER, groupIds: [] }]),
  memberIdleGroup: context("member-idle", [{ orgId: ORG, role: OrgRole.MEMBER, groupIds: [IDLE_GROUP] }]),
  memberRO: context("member-ro", [{ orgId: ORG, role: OrgRole.MEMBER, groupIds: [RO_GROUP] }]),
  memberRW: context("member-rw", [{ orgId: ORG, role: OrgRole.MEMBER, groupIds: [RW_GROUP, RO_GROUP] }]),
  manager: context("manager", [{ orgId: ORG, role: OrgRole.MANAGER, groupIds: [] }]),
  superAdmin: context("super-admin", [], true),
  superAdminGuest: context("super-admin-guest", [{ orgId: ORG, role: OrgRole.GUEST, groupIds: [] }], true),
} as const satisfies Record<string, UserAccessContext | null>;
export type ContextName = keyof typeof contexts;

export const noGrants: AccessControlInfo["grants"] = [];
export const bothGrants: AccessControlInfo["grants"] = [
  { group_id: RO_GROUP, access_level: GrantLevel.RO },
  { group_id: RW_GROUP, access_level: GrantLevel.RW },
];

export function accessControl(overrides?: Partial<AccessControlInfo>): AccessControlInfo {
  return {
    id: "ac-id",
    org_id: ORG,
    org: { name: "Org" },
    sharing: Sharing.ORG,
    grants: [],
    ...overrides,
  };
}

/** Every sharing × grants combination worth telling apart */
export const accessControls = {
  publicNoGrants: accessControl({ sharing: Sharing.PUBLIC, grants: noGrants }),
  publicWithGrants: accessControl({ sharing: Sharing.PUBLIC, grants: bothGrants }),
  orgNoGrants: accessControl({ sharing: Sharing.ORG, grants: noGrants }),
  orgWithGrants: accessControl({ sharing: Sharing.ORG, grants: bothGrants }),
  groupsNoGrants: accessControl({ sharing: Sharing.GROUPS, grants: noGrants }),
  groupsWithGrants: accessControl({ sharing: Sharing.GROUPS, grants: bothGrants }),
} as const;
export type AccessControlName = keyof typeof accessControls;
