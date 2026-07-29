import { AccessLevel, OrgRole } from "@/lib/prisma/generated";
import type { Prisma } from "@/lib/prisma/generated";
import type { UserAccessContext } from "@/types";

/*
 * Prisma `where`-clause builders for the access ladder — the query-side counterpart to accessChecker.
 * Pass `null` as the context for anonymous visitors (public content only).
 *
 * The ladder:
 * - superadmin -> everything
 * - MANAGER of the AC's org -> read + write
 * - RW grant via a group -> read + write (content only, not sharing settings)
 * - RO grant / org_readable (members, not GUESTs) / is_public -> read
 * - Draft iterations (published_at == null) -> visible only with write access
 */

/** Ids of orgs the user manages */
export function managedOrgIds(ctx: UserAccessContext): string[] {
  return ctx.memberships.filter(m => m.role === OrgRole.MANAGER).map(m => m.orgId);
}

/** Ids of orgs where the user is a proper member (MEMBER or MANAGER; GUESTs are excluded from org_readable) */
export function memberOrgIds(ctx: UserAccessContext): string[] {
  return ctx.memberships.filter(m => m.role !== OrgRole.GUEST).map(m => m.orgId);
}

/** Ids of all groups the user is in, across all orgs (grants are same-org by construction) */
export function allGroupIds(ctx: UserAccessContext): string[] {
  return ctx.memberships.flatMap(m => m.groupIds);
}

/**
 * Matches access controls the user may read.
 */
export function readableAccessControlWhere(ctx: UserAccessContext | null): Prisma.AccessControlsWhereInput {
  if (!ctx) {
    return { is_public: true };
  }
  if (ctx.isSuperAdmin) {
    return {};
  }
  return {
    OR: [
      { is_public: true },
      { org_id: { in: managedOrgIds(ctx) } },
      { org_readable: true, org_id: { in: memberOrgIds(ctx) } },
      { grants: { some: { group_id: { in: allGroupIds(ctx) } } } },
    ],
  };
}

/**
 * Matches access controls the user may write under (content writes; sharing settings are manager-only).
 */
export function writableAccessControlWhere(ctx: UserAccessContext | null): Prisma.AccessControlsWhereInput {
  if (!ctx) {
    // `in: []` matches nothing: anonymous visitors can never write
    return { org_id: { in: [] } };
  }
  if (ctx.isSuperAdmin) {
    return {};
  }
  return {
    OR: [
      { org_id: { in: managedOrgIds(ctx) } },
      { grants: { some: { group_id: { in: allGroupIds(ctx) }, access_level: AccessLevel.RW } } },
    ],
  };
}

/**
 * Matches roadmap iterations the user may see: readable via the roadmap's access control,
 * and either published or (for drafts) writable.
 */
export function visibleRoadmapIterationsWhere(ctx: UserAccessContext | null): Prisma.RoadmapIterationsWhereInput {
  return {
    roadmap: { access_control: readableAccessControlWhere(ctx) },
    OR: [
      { published_at: { not: null } },
      { roadmap: { access_control: writableAccessControlWhere(ctx) } },
    ],
  };
}
