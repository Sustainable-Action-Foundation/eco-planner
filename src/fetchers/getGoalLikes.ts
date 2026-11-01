import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { listedGoalsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import { GeoAreaType } from "@/lib/prisma/generated";
import { isLikeAspect } from "@/functions/likeAspect";
import { LikeAspect, LikeScope } from "@/types/enums";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

export type GoalLikeSummary = {
  likeCount: number,
  /** Whether the requesting user is among the likers */
  likedByViewer: boolean,
  /** The aspects of the requesting user's like, in `LikeAspect` order */
  viewerAspects: LikeAspect[],
};

/** How many of the likes in scope carry each aspect; aspects nobody chose are left out */
export type LikeAspectCounts = Partial<Record<LikeAspect, number>>;

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
  /** The aspects of the requesting user's like */
  viewerAspects: LikeAspect[],
  /** Per aspect, how many of the likes in scope (those counted in `likeCount`) carry it */
  aspectCounts: LikeAspectCounts,
  /** Goals in the landing's org derived from this one, see `findCopies` */
  copies: { id: string, name: string | null, indicatorParameter: string }[],
};

/** How many likes a goal has and whether the current user gave one of them. Zero and false for goals the user can't see. */
export async function getGoalLikeSummary(goalId: string): Promise<GoalLikeSummary> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedGoalLikeSummary(goalId, accessContext), { likeCount: 0, likedByViewer: false, viewerAspects: [] }, "Error fetching goal likes:");
}

async function getCachedGoalLikeSummary(goalId: string, accessContext: UserAccessContext | null): Promise<GoalLikeSummary> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal', 'roadmap', 'roadmapIteration');

  return boundedFill("getCachedGoalLikeSummary", async () => {
    const goal = await prisma.goals.findUnique({
      where: { id: goalId, roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext) },
      select: {
        _count: { select: { likes: true } },
        // Nobody's likes for an anonymous viewer: no user has the empty id
        likes: { where: { user_id: accessContext?.id ?? "" }, select: { aspects: { select: { aspect: true } } } },
      },
    });
    if (!goal) return { likeCount: 0, likedByViewer: false, viewerAspects: [] };
    const own = goal.likes.at(0);
    return { likeCount: goal._count.likes, likedByViewer: !!own, viewerAspects: knownAspects(own?.aspects ?? []) };
  });
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
  return uncachedFallback(() => getCachedLikeScopes(orgId), [{ scope: LikeScope.Org, area: null }], "Error fetching like scopes:");
}

async function getCachedLikeScopes(orgId: string): Promise<LikeScopeOption[]> {
  'use cache';
  cacheTag('database', 'org');

  return boundedFill("getCachedLikeScopes", async () => {
    const scopes: LikeScopeOption[] = [{ scope: LikeScope.Org, area: null }];
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
    return scopes;
  });
}

/** A municipality or county whose orgs' likes are pooled on its likes overview, see `getLikeArea` */
export type LikeArea = {
  code: string,
  name: string,
  type: GeoAreaType,
  /** The county a municipality lies in */
  parent: { code: string, name: string } | null,
  /** The orgs whose members' likes are pooled: placed in the area, or (for a county) in one of its municipalities */
  orgs: { id: string, name: string, geoAreaCode: string }[],
  /** For a county, its municipalities that have orgs placed in them */
  municipalities: { code: string, name: string }[],
};

/**
 * A municipality or county with the orgs whose likes it pools, if the viewer
 * may see its likes overview: signed in and a member (guests included) of one
 * of those orgs, or a super admin. Null otherwise, and for the nation and
 * unknown codes, so the page can't tell whether an area exists.
 */
export async function getLikeArea(areaCode: string): Promise<LikeArea | null> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) return null;
  const area = await uncachedFallback(() => getCachedLikeArea(areaCode), null, "Error fetching like area:");
  if (!area) return null;
  const memberOf = new Set(accessContext.memberships.map(membership => membership.orgId));
  if (!accessContext.isSuperAdmin && !area.orgs.some(org => memberOf.has(org.id))) return null;
  return area;
}

async function getCachedLikeArea(areaCode: string): Promise<LikeArea | null> {
  'use cache';
  cacheTag('database', 'org');

  return boundedFill("getCachedLikeArea", async () => {
    const area = await prisma.geoAreas.findUnique({
      where: { code: areaCode },
      select: { code: true, name: true, type: true, parent: { select: { code: true, name: true, type: true } } },
    });
    if (!area || area.type === GeoAreaType.NATION) return null;

    const orgs = await prisma.orgs.findMany({
      where: { geo_area: { OR: [{ code: area.code }, { parent_code: area.code }] } },
      select: { id: true, name: true, geo_area: { select: { code: true, name: true } } },
      orderBy: { name: "asc" },
    });
    const municipalities = new Map<string, string>();
    for (const org of orgs) {
      if (org.geo_area && org.geo_area.code !== area.code) municipalities.set(org.geo_area.code, org.geo_area.name);
    }

    return {
      code: area.code,
      name: area.name,
      type: area.type,
      parent: area.parent?.type === GeoAreaType.COUNTY ? { code: area.parent.code, name: area.parent.name } : null,
      orgs: orgs.flatMap(org => org.geo_area ? [{ id: org.id, name: org.name, geoAreaCode: org.geo_area.code }] : []),
      municipalities: [...municipalities].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "sv")),
    };
  });
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
  return uncachedFallback(() => getCachedLikedGoals(orgId, area?.code ?? null, accessContext), [], "Error fetching liked goals:");
}

/**
 * The goals liked by members of the orgs placed in a geo area (a county
 * includes its municipalities), ranked like `getLikedGoals`'s area scope.
 * Has no landing org, so no copies are marked. Callers check that the viewer
 * may see the area's compilation.
 */
export async function getLikedGoalsInArea(areaCode: string): Promise<LikedGoal[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) return [];
  return uncachedFallback(() => getCachedLikedGoals(null, areaCode, accessContext), [], "Error fetching liked goals:");
}

/**
 * A ranked list of liked goals narrowed to those liked with the aspect,
 * ranked by how many likes in scope carry it (ties keep the ranking by
 * likes); the list as is when no aspect is given.
 */
export function rankByAspect(goals: LikedGoal[], aspect?: LikeAspect | null): LikedGoal[] {
  if (!aspect) return goals;
  return goals
    .filter(goal => (goal.aspectCounts[aspect] ?? 0) > 0)
    // Stable sort: ties keep the ranking by likes
    .sort((a, b) => (b.aspectCounts[aspect] ?? 0) - (a.aspectCounts[aspect] ?? 0));
}

/** The listed aspects among stored ones, in `LikeAspect` order; unlisted (retired) values are dropped */
function knownAspects(stored: { aspect: string }[]): LikeAspect[] {
  return Object.values(LikeAspect).filter(aspect => stored.some(row => row.aspect === aspect));
}

async function getCachedLikedGoals(orgId: string | null, areaCode: string | null, accessContext: UserAccessContext): Promise<LikedGoal[]> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal', 'roadmap', 'roadmapIteration', 'dataSeries', 'org');

  return boundedFill("getCachedLikedGoals", async () => {
    // Whose likes count: members of the org, or of any org placed in the area or in an area directly under it
    const inScope: Prisma.OrgMembershipsWhereInput = areaCode
      ? { org: { geo_area: { OR: [{ code: areaCode }, { parent_code: areaCode }] } } }
      : { org_id: orgId ?? "" };

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
            aspects: { select: { aspect: true } },
            user: { select: { memberships: { where: inScope, select: { org_id: true } } } },
          },
        },
      },
    });

    const copiesBySource = orgId
      ? await findCopies(orgId, accessContext, goals.flatMap(goal => goal.data_series_id ? [goal.data_series_id] : []))
      : new Map<string, LikedGoal["copies"]>();

    const liked = goals.map(goal => {
      // One like per user and goal, so a member of several orgs in scope still counts once
      const scopedLikes = goal.likes.filter(like => like.user.memberships.length > 0);
      const aspectCounts: LikeAspectCounts = {};
      for (const like of scopedLikes) {
        for (const { aspect } of like.aspects) {
          if (isLikeAspect(aspect)) aspectCounts[aspect] = (aspectCounts[aspect] ?? 0) + 1;
        }
      }
      const own = goal.likes.find(like => like.user_id === accessContext.id);
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
        likedByViewer: !!own,
        viewerAspects: knownAspects(own?.aspects ?? []),
        aspectCounts,
        copies: goal.data_series_id ? copiesBySource.get(goal.data_series_id) ?? [] : [],
      };
    });

    return liked.sort((a, b) => b.likeCount - a.likeCount || b.latestLikeAt.getTime() - a.latestLikeAt.getTime() || a.id.localeCompare(b.id));
  });
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
