import { AccessLevel as GrantLevel, IterationStatus, OrgRole, Sharing } from "@/lib/prisma/generated";
import type { AccessControlled, AccessControlInfo, UserAccessContext } from "@/types";
import { AccessLevel } from "@/types/enums";

/*
 * The access ladder, in order:
 * - super admin -> admin everywhere
 * - MANAGER of the access control's org -> admin (content + sharing settings + group management)
 * - RW grant via a group -> edit (content only; sharing settings are admin-only)
 * - RO grant / ORG sharing (members, not GUESTs) / PUBLIC sharing -> view
 * - Draft versions (status DRAFT) are only visible with edit access or better
 *
 * Authorship is cosmetic and never grants access. The query-side counterpart to this
 * ladder lives in `@/lib/accessFilters` — keep the two in sync.
 */

/**
 * Checks if the user has access to an item and returns their access level. An empty string means no access.
 * @param item An object that implements the `AccessControlled` interface
 * @param userAccessContext The requesting user's access context (see `getUserAccessContext`); null for anonymous visitors
 * @returns A string representing the user's access level to the item; "", "VIEW", "EDIT", or "ADMIN", based on the `AccessLevel` object
 */
export default function accessChecker(item: AccessControlled | null | undefined, userAccessContext: UserAccessContext | null | undefined): AccessLevel {
  // If the item is null or undefined, return no access
  if (!item) return AccessLevel.None;

  const accessLevel = accessControlLevel(item.access_control, userAccessContext);

  // Draft versions are only visible to users who could edit them.
  // Items without a `status` field (roadmaps themselves) are unaffected.
  if (item.status === IterationStatus.DRAFT && !hasEditAccess(accessLevel)) return AccessLevel.None;

  return accessLevel;
}

/**
 * The ladder itself, on a bare access control (no draft handling).
 */
function accessControlLevel(accessControl: AccessControlInfo, userAccessContext: UserAccessContext | null | undefined): AccessLevel {
  if (userAccessContext?.isSuperAdmin) return AccessLevel.Admin;

  // The user's membership in the org owning the access control, if any
  const membership = userAccessContext?.memberships.find(membership => membership.orgId === accessControl.org_id);
  if (membership?.role === OrgRole.MANAGER) return AccessLevel.Admin;

  // Grants can only reference groups in the owning org (enforced by composite FKs),
  // so matching on group id alone cannot leak access across orgs
  const userGroupIds = new Set(userAccessContext?.memberships.flatMap(membership => membership.groupIds) ?? []);
  const userGrants = accessControl.grants.filter(grant => userGroupIds.has(grant.group_id));

  if (userGrants.some(grant => grant.access_level === GrantLevel.RW)) return AccessLevel.Edit;

  if (accessControl.sharing === Sharing.PUBLIC) return AccessLevel.View;
  // Any remaining grant is RO
  if (userGrants.length > 0) return AccessLevel.View;
  // GUESTs are cross-org contributors and only see what their groups grant (plus public content)
  if (accessControl.sharing === Sharing.ORG && membership && membership.role !== OrgRole.GUEST) return AccessLevel.View;

  // User does not have access
  return AccessLevel.None;
}

/**
 * Admin access = managing sharing settings (sharing, grants) and org groups.
 * Only super admins and managers of the owning org get this; RW grants deliberately don't.
 */
export function hasAdminAccess(accessLevel: AccessLevel): boolean {
  return accessLevel === AccessLevel.Admin;
}

export function hasEditAccess(accessLevel: AccessLevel): boolean {
  if (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Admin) {
    return true;
  }
  return false;
}

export function hasViewAccess(accessLevel: AccessLevel): boolean {
  if (accessLevel === AccessLevel.View || hasEditAccess(accessLevel)) {
    return true;
  }
  return false;
}

/**
 * Commenting requires view access and a signed-in user (no grant needed on public content).
 */
export function hasCommentAccess(accessLevel: AccessLevel, userAccessContext: UserAccessContext | null | undefined): boolean {
  return hasViewAccess(accessLevel) && !!userAccessContext;
}
