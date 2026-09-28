import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { listedGoalsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
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
  /** Likes from members of the landing's org: what the list is ranked by */
  likeCount: number,
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

/**
 * The goals an org's members have liked, ranked by how many of the members
 * liked them and then by the most recent like, so the org can see which goals
 * its people want to work on. Only goals the requesting user can see and that
 * belong in listings are included; likes from outside the org count towards
 * `totalLikeCount` but not the ranking.
 */
export async function getLikedGoals(orgId: string): Promise<LikedGoal[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) return [];
  return getCachedLikedGoals(orgId, accessContext);
}

async function getCachedLikedGoals(orgId: string, accessContext: UserAccessContext): Promise<LikedGoal[]> {
  'use cache';
  cacheTag('database', 'goalLike', 'goal', 'roadmap', 'roadmapIteration', 'dataSeries', 'org');

  try {
    const goals = await prisma.goals.findMany({
      where: {
        likes: { some: { user: { memberships: { some: { org_id: orgId } } } } },
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
            user: { select: { memberships: { where: { org_id: orgId }, select: { org_id: true } } } },
          },
        },
      },
    });

    const copiesBySource = await findCopies(orgId, accessContext, goals.flatMap(goal => goal.data_series_id ? [goal.data_series_id] : []));

    const liked = goals.map(goal => {
      const orgLikes = goal.likes.filter(like => like.user.memberships.length > 0);
      return {
        id: goal.id,
        name: goal.name,
        indicatorParameter: goal.indicator_parameter,
        roadmap: { id: goal.roadmap_iteration.roadmap.id, name: goal.roadmap_iteration.roadmap.name, version: goal.roadmap_iteration.version },
        org: { id: goal.roadmap_iteration.roadmap.access_control.org_id, name: goal.roadmap_iteration.roadmap.access_control.org.name },
        likeCount: orgLikes.length,
        totalLikeCount: goal.likes.length,
        latestLikeAt: new Date(Math.max(...orgLikes.map(like => like.created_at.getTime()))),
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
