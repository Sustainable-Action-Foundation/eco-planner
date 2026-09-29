import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { listedGoalsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import { GeoAreaType } from "@/lib/prisma/generated";
import { LikeScope } from "@/types/enums";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

export type GoalLikeSummary = {
  likeCount: number,
  /** Whether the requesting user is among the likers */
  likedByViewer: boolean,
};

/** A goal on an org landing's ranked list of liked goals, see `getLikedGoals` */
export type LikedGoal = {
  id: string,
  name: string | null,
  indicatorParameter: string,
  roadmap: { id: string, name: string, version: number },
  /** The org owning the goal's roadmap */
  org: { id: string, name: string },
  /** Likes from the members in scope (the landing's org, or every org in its area): what the list is ranked by */
  likeCount: number,
  /** How many of the orgs in scope have a member who liked the goal */
  orgCount: number,
  /** Likes from everyone */
  totalLikeCount: number,
  latestLikeAt: Date,
  likedByViewer: boolean,
  /** Goals in the landing's org derived from this one, see `findCopies` */
  copies: { id: string, name: string | null, indicatorParameter: string }[],
};

/** How many likes a goal has and whether the current user gave one of them. Zero and false for goals the user can't see. */
export async function getGoalLikeSummary(goalId: string): Promise<GoalLikeSummary> {
  const accessContext = await getUserAccessContext();
  return getCachedGoalLikeSummary(goalId, accessContext);
}

async function getCachedGoalLikeSummary(goalId: string, accessContext: UserAccessContext | null): Promise<GoalLikeSummary> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal');

  try {
    const goal = await prisma.goals.findUnique({
      where: { id: goalId, roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext) },
      select: {
        _count: { select: { likes: true } },
        likes: accessContext ? { where: { user_id: accessContext.id }, select: { user_id: true } } : false,
      },
    });
    if (!goal) return { likeCount: 0, likedByViewer: false };
    return { likeCount: goal._count.likes, likedByViewer: (goal.likes ?? []).length > 0 };
  }
  catch (err) {
    console.error("Error fetching goal likes:", { err });
    return { likeCount: 0, likedByViewer: false };
  }
}

/** A scope the org's list of liked goals can be viewed in, see `getLikeScopes` */
export type LikeScopeOption = {
  scope: LikeScope,
  /** The area the scope covers; null for the org's own scope */
  area: { code: string, name: string } | null,
};

/**
 * The scopes an org's liked goals can be compiled over. Always the org itself;
 * an org placed in a municipality or county also gets that area, which gathers
 * the likes of every org placed in it (a county includes its municipalities),
 * and a municipal org gets its county on top. That is how the companies and
 * organizations of a municipality prioritize together.
 */
export async function getLikeScopes(orgId: string): Promise<LikeScopeOption[]> {
  'use cache';
  cacheTag('database', 'org');

  const scopes: LikeScopeOption[] = [{ scope: LikeScope.Org, area: null }];
  try {
    const org = await prisma.orgs.findUnique({
      where: { id: orgId },
      select: { geo_area: { select: { code: true, name: true, type: true, parent: { select: { code: true, name: true, type: true } } } } },
    });
    const area = org?.geo_area;
    if (area && area.type !== GeoAreaType.NATION) {
      scopes.push({ scope: LikeScope.Area, area: { code: area.code, name: area.name } });
    }
    if (area?.type === GeoAreaType.MUNICIPALITY && area.parent?.type === GeoAreaType.COUNTY) {
      scopes.push({ scope: LikeScope.County, area: { code: area.parent.code, name: area.parent.name } });
    }
  }
  catch (err) {
    console.error("Error fetching like scopes:", { err });
  }
  return scopes;
}

/**
 * The goals liked within a scope of the org (see `getLikeScopes`; its own
 * members by default), ranked by how many of the members in scope liked them
 * and then by the most recent like, so the org, or its whole area, can see
 * which goals people want to work on. Only goals the requesting user can see
 * and that belong in listings are included; likes from outside the scope
 * count towards `totalLikeCount` but not the ranking. A scope the org doesn't
 * have falls back to the org itself.
 */
export async function getLikedGoals(orgId: string, scope: LikeScope = LikeScope.Org): Promise<LikedGoal[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) return [];
  const area = (await getLikeScopes(orgId)).find(option => option.scope === scope)?.area ?? null;
  return getCachedLikedGoals(orgId, area?.code ?? null, accessContext);
}

async function getCachedLikedGoals(orgId: string, areaCode: string | null, accessContext: UserAccessContext): Promise<LikedGoal[]> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal', 'roadmap', 'roadmapIteration', 'dataSeries', 'org');

  try {
    // Whose likes count: members of the org, or of any org placed in the area or in an area directly under it
    const inScope: Prisma.OrgMembershipsWhereInput = areaCode
      ? { org: { geo_area: { OR: [{ code: areaCode }, { parent_code: areaCode }] } } }
      : { org_id: orgId };

    const goals = await prisma.goals.findMany({
      where: {
        likes: { some: { user: { memberships: { some: inScope } } } },
        roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext),
        AND: [listedGoalsWHERE(accessContext)],
      },
      select: {
        id: true,
        name: true,
        indicator_parameter: true,
        data_series_id: true,
        roadmap_iteration: {
          select: {
            version: true,
            roadmap: { select: { id: true, name: true, access_control: { select: { org_id: true, org: { select: { name: true } } } } } },
          },
        },
        likes: {
          select: {
            user_id: true,
            created_at: true,
            user: { select: { memberships: { where: inScope, select: { org_id: true } } } },
          },
        },
      },
    });

    const copiesBySource = await findCopies(orgId, accessContext, goals.flatMap(goal => goal.data_series_id ? [goal.data_series_id] : []));

    const liked = goals.map(goal => {
      // One like per user and goal, so a member of several orgs in scope still counts once
      const scopedLikes = goal.likes.filter(like => like.user.memberships.length > 0);
      return {
        id: goal.id,
        name: goal.name,
        indicatorParameter: goal.indicator_parameter,
        roadmap: { id: goal.roadmap_iteration.roadmap.id, name: goal.roadmap_iteration.roadmap.name, version: goal.roadmap_iteration.version },
        org: { id: goal.roadmap_iteration.roadmap.access_control.org_id, name: goal.roadmap_iteration.roadmap.access_control.org.name },
        likeCount: scopedLikes.length,
        orgCount: new Set(scopedLikes.flatMap(like => like.user.memberships.map(membership => membership.org_id))).size,
        totalLikeCount: goal.likes.length,
        latestLikeAt: new Date(Math.max(...scopedLikes.map(like => like.created_at.getTime()))),
        likedByViewer: goal.likes.some(like => like.user_id === accessContext.id),
        copies: goal.data_series_id ? copiesBySource.get(goal.data_series_id) ?? [] : [],
      };
    });

    return liked.sort((a, b) => b.likeCount - a.likeCount || b.latestLikeAt.getTime() - a.latestLikeAt.getTime() || a.id.localeCompare(b.id));
  }
  catch (err) {
    console.error("Error fetching liked goals:", { err });
    return [];
  }
}

/**
 * The org's goals derived from the given data series, keyed by series id. A
 * copy of a goal has no record of its origin; what it keeps is its recipe,
 * which reads the original's data series to scale from (see
 * `goalPrefilledSeries`). So a goal counts as copied into the org when one of
 * the org's goals is computed from its series. A copy whose recipe was later
 * rewritten to not read the original, or one that was pasted in by hand,
 * isn't recognised.
 */
async function findCopies(orgId: string, accessContext: UserAccessContext, sourceSeriesIds: string[]): Promise<Map<string, LikedGoal["copies"]>> {
  const copies = new Map<string, LikedGoal["copies"]>();
  if (sourceSeriesIds.length === 0) return copies;

  const derived = await prisma.goals.findMany({
    where: {
      roadmap_iteration: { roadmap: { access_control: { org_id: orgId } }, AND: [visibleRoadmapIterationsWHERE(accessContext)] },
      data_series: { recipe_used: { source_data_series: { some: { id: { in: sourceSeriesIds } } } } },
    },
    select: {
      id: true,
      name: true,
      indicator_parameter: true,
      data_series: { select: { recipe_used: { select: { source_data_series: { where: { id: { in: sourceSeriesIds } }, select: { id: true } } } } } },
    },
  });

  for (const goal of derived) {
    for (const source of goal.data_series?.recipe_used.source_data_series ?? []) {
      const list = copies.get(source.id) ?? [];
      list.push({ id: goal.id, name: goal.name, indicatorParameter: goal.indicator_parameter });
      copies.set(source.id, list);
    }
  }
  return copies;
}
