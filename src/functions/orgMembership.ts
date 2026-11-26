// No `server-only` marker: pure and shared by the membership API, the manage page and its tests.

import { managesOrg } from "@/lib/accessChecker";
import { OrgRole } from "@/lib/prisma/generated";
import type { UserAccessContext } from "@/types";

/*
 * Who may change who an org's members are. One function per action, used by the API
 * (/api/org-membership) and by the manage page alike:
 *
 *                               manager ("ansvarig") of the org     super admin, powers on
 *   add an existing user        yes, by exact e-mail address        yes, also from the user list
 *   remove a member             yes, except themselves              yes
 *   move a member               yes, between orgs they manage,      yes, to any org
 *                               except themselves
 *   see every user and address  no                                  yes
 *
 * `isSuperAdmin` in the access context is the effective value: a super admin who has
 * suspended their powers is whatever their memberships make them.
 */

/** Whether the user decides who the org's members are at all: its managers and super admins. */
export function managesMembers(userAccessContext: UserAccessContext | null | undefined, orgId: string): boolean {
  return managesOrg(userAccessContext, orgId);
}

/**
 * Whether the user gets the list of every user with their address, and may add from it.
 * Super admins only: a manager adds by typing an exact address instead.
 */
export function browsesAllUsers(userAccessContext: UserAccessContext | null | undefined): boolean {
  return userAccessContext?.isSuperAdmin === true;
}

/**
 * Whether the user may remove this membership from the org. Managers may not remove
 * their own, in the spirit of nobody changing their own role: an org should not
 * manage away its last manager by accident.
 */
export function removesMember(userAccessContext: UserAccessContext | null | undefined, orgId: string, isOwnMembership: boolean): boolean {
  if (!managesMembers(userAccessContext, orgId)) return false;
  return userAccessContext?.isSuperAdmin === true || !isOwnMembership;
}

/**
 * Whether the user may move this membership to another org: they must decide over the
 * members of both, so a manager moves only between orgs they manage, and never themselves.
 */
export function movesMember(userAccessContext: UserAccessContext | null | undefined, fromOrgId: string, toOrgId: string, isOwnMembership: boolean): boolean {
  return removesMember(userAccessContext, fromOrgId, isOwnMembership) && managesMembers(userAccessContext, toOrgId);
}

/**
 * The role a membership request asks for: MEMBER or MANAGER, else null. GUEST is not
 * assignable: it is a different relationship rather than a rank, and guests are disabled.
 */
export function assignableRole(value: unknown): typeof OrgRole.MEMBER | typeof OrgRole.MANAGER | null {
  return value === OrgRole.MANAGER ? OrgRole.MANAGER
    : value === OrgRole.MEMBER ? OrgRole.MEMBER
      : null;
}

/**
 * The role a moved membership gets in the new org: the one asked for, else the one it
 * had. A lingering GUEST row moves as a plain member.
 */
export function movedRole(requested: unknown, current: OrgRole): typeof OrgRole.MEMBER | typeof OrgRole.MANAGER {
  return assignableRole(requested) ?? assignableRole(current) ?? OrgRole.MEMBER;
}

/**
 * Whether taking this membership out of the org leaves members without anyone to
 * manage them: it is the org's only manager and others remain. Not an error (super
 * admins still administer the org, and orgs without managers exist), but worth a
 * warning before it happens.
 */
export function leavesOrgWithoutManager(members: { membershipId: string, role: OrgRole }[], membershipId: string): boolean {
  const leaving = members.find(member => member.membershipId === membershipId);
  if (leaving?.role !== OrgRole.MANAGER) return false;
  const remaining = members.filter(member => member.membershipId !== membershipId && member.role !== OrgRole.GUEST);
  return remaining.length > 0 && !remaining.some(member => member.role === OrgRole.MANAGER);
}

/**
 * How many accounts a manager may look up by address: a burst of 30 (a new team in
 * one sitting), then one every ten seconds. The answer tells whether an address has an
 * account, so the lookups are bounded per manager; super admins see the list anyway.
 */
export const memberLookupRate = { capacity: 30, refillPerSecond: 0.1 };
