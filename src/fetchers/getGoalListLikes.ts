import "server-only";
import { getLikeScopes, likersInScopeWHERE } from "@/fetchers/getGoalLikes";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { defaultLikeFilter, likeFilterHref, likeFilterOrgParam, likeFilterParam, resolveLikeFilter, wantsLikeFilter } from "@/functions/likeFilter";
import { listedGoalsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import { LikeFilter } from "@/types/enums";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

type SearchParams = { [key: string]: string | string[] | undefined };

/** A choice of whose likes a roadmap version's goal list counts */
export type LikeFilterOption = {
  filter: LikeFilter,
  /** The org whose members' likes count, or the area whose orgs' do; null for the viewer's own likes and for everyone's */
  name: string | null,
  /** The page with the list filtered on this */
  href: string,
};

/** What a roadmap version's goal list needs to show only liked goals, see `getGoalListLikes` */
export type GoalListLikes = {
  /** Whose likes the list is filtered on; null for the whole list */
  active: LikeFilter | null,
  /** The filters the viewer can choose between, narrowest first. Only looked up while one is in use */
  options: LikeFilterOption[],
  /** Per goal id, the likes the active filter counts; goals without one are left out */
  counts: Record<string, number>,
  /** The page with the list filtered on the viewer's default filter */
  onHref: string,
  /** The page with the whole list */
  offHref: string,
};

/**
 * The liked goals of a roadmap version as its page's `?likes=` asks for them
 * (see `LikeFilter`): which filter is in use, the ones the viewer can switch
 * to, and how many likes each goal has within it.
 *
 * Whose likes a viewer may count follows what they can already see elsewhere:
 * - their own, and everyone's (the count on each goal's page), for any
 *   signed-in user;
 * - the scopes of an org they belong to (`getLikeScopes`: its members, its
 *   area, its county), as on that org's landing page. `?org=` picks the org
 *   as it does there; the default is the first proper membership. A super
 *   admin without one looks from the org owning the roadmap.
 *
 * Null for anonymous visitors, who are shown no likes anywhere. A filter the
 * viewer doesn't have falls back to their default one. Nothing is read from
 * the database while no filter is in use.
 */
export async function getGoalListLikes(
  iteration: { id: string, roadmap: { access_control: { org_id: string } } },
  /** The page's path and search params, for the links between filters */
  path: string,
  searchParams: SearchParams,
): Promise<GoalListLikes | null> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) return null;

  const offHref = likeFilterHref(path, searchParams, null);
  const requested = searchParams[likeFilterParam];
  const hasOrg = accessContext.isSuperAdmin || accessContext.memberships.length > 0;

  if (!wantsLikeFilter(requested)) {
    const start = defaultLikeFilter(hasOrg ? [LikeFilter.Org, LikeFilter.All] : [LikeFilter.All]);
    return { active: null, options: [], counts: {}, onHref: likeFilterHref(path, searchParams, start), offHref };
  }

  const userOrgs = hasOrg ? await getUserOrgs() : [];
  const orgParam = searchParams[likeFilterOrgParam];
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  const org = userOrgs.find(candidate => candidate.id === orgId)
    ?? userOrgs.find(candidate => candidate.isMember && !candidate.isGuest)
    ?? userOrgs.find(candidate => candidate.id === iteration.roadmap.access_control.org_id)
    ?? null;
  const scopes = org ? await getLikeScopes(org.id) : [];

  const choices: { filter: LikeFilter, name: string | null, areaCode: string | null }[] = [
    { filter: LikeFilter.Mine, name: null, areaCode: null },
    ...scopes.map(option => ({ filter: option.scope, name: option.area?.name ?? org?.name ?? null, areaCode: option.area?.code ?? null })),
    { filter: LikeFilter.All, name: null, areaCode: null },
  ];
  const available = choices.map(choice => choice.filter);
  const active = resolveLikeFilter(requested, available);
  const chosen = choices.find(choice => choice.filter === active);
  const scoped = scopes.some(option => option.scope === active);

  const counts = active
    ? await uncachedFallback(
      // The org and area only matter to the scopes; left out otherwise so the other filters share an entry across orgs
      () => getCachedGoalListLikeCounts(iteration.id, active, scoped ? org?.id ?? null : null, scoped ? chosen?.areaCode ?? null : null, accessContext),
      {},
      "Error fetching goal list likes:",
    )
    : {};

  return {
    active,
    options: choices.map(choice => ({ filter: choice.filter, name: choice.name, href: likeFilterHref(path, searchParams, choice.filter) })),
    counts,
    onHref: likeFilterHref(path, searchParams, defaultLikeFilter(available)),
    offHref,
  };
}

/**
 * Likes per goal of one roadmap version, from the likers a filter counts, in
 * one grouped query however many goals the version has. Only goals the viewer
 * can see and would be listed for them are counted.
 */
async function getCachedGoalListLikeCounts(
  iterationId: string,
  filter: LikeFilter,
  orgId: string | null,
  areaCode: string | null,
  accessContext: UserAccessContext,
): Promise<Record<string, number>> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal', 'roadmap', 'roadmapIteration', 'org');

  return boundedFill("getCachedGoalListLikeCounts", async () => {
    const likers: Prisma.GoalLikesWhereInput = filter === LikeFilter.Mine
      ? { user_id: accessContext.id }
      : filter === LikeFilter.All
        ? {}
        // One like per user and goal, so a member of several orgs in scope still counts once
        : { user: { memberships: { some: likersInScopeWHERE(orgId, areaCode) } } };

    const rows = await prisma.goalLikes.groupBy({
      by: ["goal_id"],
      where: {
        ...likers,
        goal: {
          roadmap_iteration_id: iterationId,
          roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext),
          AND: [listedGoalsWHERE(accessContext)],
        },
      },
      _count: { _all: true },
    });

    return Object.fromEntries(rows.map(row => [row.goal_id, row._count._all]));
  });
}
