// No `server-only` marker: pure and shared by the membership API, the manage page and its tests.

import { OrgRole } from "@/lib/prisma/generated";
import type { UserAccessContext } from "@/types";

/**
 * Who may add users to an org, remove its members and move them to another org:
 * super admins (with their powers on) only. Managers still only change roles.
 *
 * This is the one place that decides it, for the API and for the manage page alike.
 * Whether managers should manage their own org's members is an open product question;
 * to let them, return `managesOrg(userAccessContext, orgId)` (from `@/lib/accessChecker`)
 * here. A move asks for both orgs, so a manager could then only move members between
 * orgs they manage; and the API would need a lock on removing oneself, like the one on
 * changing one's own role, or an org could manage away its last manager.
 */
export function administersMembers(userAccessContext: UserAccessContext | null | undefined, _orgId: string): boolean {
  return userAccessContext?.isSuperAdmin === true;
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
