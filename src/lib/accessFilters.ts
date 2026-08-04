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

/**
 * Matches actions the user may see: those under a visible iteration, plus
 * roadmapless actions (the public action database).
 */
export function visibleActionsWhere(ctx: UserAccessContext | null): Prisma.ActionsWhereInput {
  return {
    OR: [
      { roadmap_iteration: null },
      { roadmap_iteration: visibleRoadmapIterationsWhere(ctx) },
    ],
  };
}

/**
 * Matches actions the user may edit: those under a writable roadmap, plus
 * roadmapless actions (the public action database) for managers of the owning org.
 */
export function editableActionsWhere(ctx: UserAccessContext | null): Prisma.ActionsWhereInput {
  if (!ctx) {
    // `in: []` matches nothing: anonymous visitors can never write
    return { org_id: { in: [] } };
  }
  if (ctx.isSuperAdmin) {
    return {};
  }
  return {
    OR: [
      { roadmap_iteration: { roadmap: { access_control: writableAccessControlWhere(ctx) } } },
      { roadmap_iteration: null, org_id: { in: managedOrgIds(ctx) } },
    ],
  };
}

/**
 * Matches data series the user may edit (e.g. recalculate). Like visibility, edit
 * access is derived from the parent goal/effect context; effects require edit access
 * to both the action and the goal.
 */
export function editableDataSeriesWhere(ctx: UserAccessContext | null): Prisma.DataSeriesWhereInput {
  const writableIteration: Prisma.RoadmapIterationsWhereInput = {
    roadmap: { access_control: writableAccessControlWhere(ctx) },
  };
  return {
    OR: [
      { dependent_goal: { roadmap_iteration: writableIteration } },
      { dependent_baseline: { roadmap_iteration: writableIteration } },
      { dependent_historical: { roadmap_iteration: writableIteration } },
      {
        dependent_effect: {
          action: editableActionsWhere(ctx),
          goal: { roadmap_iteration: writableIteration },
        },
      },
    ],
  };
}

/**
 * Matches data series the user may see. Series visibility is derived from the parent
 * goal/effect context (series have no access control of their own): the series is visible
 * if any of its dependent slots sits under a visible iteration.
 */
export function visibleDataSeriesWhere(ctx: UserAccessContext | null): Prisma.DataSeriesWhereInput {
  const visibleIterations = visibleRoadmapIterationsWhere(ctx);
  return {
    OR: [
      { dependent_goal: { roadmap_iteration: visibleIterations } },
      { dependent_baseline: { roadmap_iteration: visibleIterations } },
      { dependent_historical: { roadmap_iteration: visibleIterations } },
      // Effects require access to both the action and the goal
      {
        dependent_effect: {
          action: visibleActionsWhere(ctx),
          goal: { roadmap_iteration: visibleIterations },
        },
      },
    ],
  };
}
