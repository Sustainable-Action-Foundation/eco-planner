import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { listedRoadmapsWHERE, visibleActionsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { HiddenRoadmaps } from "@/types/enums";
import { cacheTag } from "next/cache";

/** What the viewer can see of the org's work, in numbers: the landing's process and key figures */
export type OrgCounts = {
  /** Goals in the org's listed roadmaps, unlisted ones included: they are readable, and only whether there are any is shown */
  goals: number,
  /** Of those, the ones with a baseline */
  goalsWithBaseline: number,
  /** Of those, the ones an action has an effect on */
  goalsWithActions: number,
  /** The org's actions, as its action list shows them */
  actions: number,
};

const noCounts: OrgCounts = { goals: 0, goalsWithBaseline: 0, goalsWithActions: 0, actions: 0 };

/**
 * Counts of the org's goals and actions, over what the requesting user may see:
 * hidden roadmaps and drafts only count for those who can write to them, so the
 * numbers never reveal more than the lists do.
 * @param options.asVisitor What a visitor without a login gets, whoever asks (the public view's preview)
 */
export async function getOrgCounts(orgId: string, options: { asVisitor?: boolean } = {}): Promise<OrgCounts> {
  const accessContext = options.asVisitor ? null : await getUserAccessContext();
  return uncachedFallback(() => getCachedOrgCounts(orgId, accessContext), noCounts, "Error fetching org counts", { orgId });
}

async function getCachedOrgCounts(orgId: string, accessContext: UserAccessContext | null): Promise<OrgCounts> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'roadmap', 'roadmapIteration');

  return boundedFill("getCachedOrgCounts", async () => {
    const listedRoadmap = listedRoadmapsWHERE(accessContext, HiddenRoadmaps.Exclude);
    const goals: Prisma.GoalsWhereInput = {
      roadmap_iteration: {
        AND: [
          visibleRoadmapIterationsWHERE(accessContext),
          { roadmap: { AND: [{ access_control: { org_id: orgId } }, listedRoadmap] } },
        ],
      },
    };

    const [goalCount, goalsWithBaseline, goalsWithActions, actions] = await Promise.all([
      prisma.goals.count({ where: goals }),
      prisma.goals.count({ where: { ...goals, baseline_id: { not: null } } }),
      prisma.goals.count({ where: { ...goals, effects: { some: {} } } }),
      // Same filter as the org's action list (getActionSummaries)
      prisma.actions.count({
        where: {
          AND: [
            { org_id: orgId },
            visibleActionsWHERE(accessContext),
            { OR: [{ roadmap_iteration: null }, { roadmap_iteration: { roadmap: listedRoadmap } }] },
          ],
        },
      }),
    ]);

    return { goals: goalCount, goalsWithBaseline, goalsWithActions, actions };
  });
}
