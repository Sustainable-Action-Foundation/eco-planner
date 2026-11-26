import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { currentIteration } from "@/functions/orgReport";
import { listedActionsWHERE, listedGoalsWHERE, listedRoadmapsWHERE, readableAccessControlWHERE, visibleEffectsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import { GoalListing } from "@/lib/prisma/generated";
import type { ActionImpactType, IterationStatus, RoadmapType, Sharing } from "@/lib/prisma/generated";
import { goalSorter, roadmapSorter } from "@/lib/sorters";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { HiddenRoadmaps } from "@/types/enums";
import { cacheTag } from "next/cache";

/**
 * A series as the report draws and tabulates it: `[year, value]` pairs in year order.
 * Compact on purpose: an org can have hundreds of goals with three series each, and
 * the entry is cached per user.
 */
export type ReportSeries = { unit: string | null, points: [year: number, value: number][] };

/** What an action does to a goal, with the action it comes from */
export type ReportEffect = {
  impactType: ActionImpactType,
  series: ReportSeries | null,
  action: { id: string, name: string, startYear: number | null, endYear: number | null },
};

export type ReportGoal = {
  id: string,
  name: string | null,
  description: string | null,
  indicatorParameter: string,
  listing: GoalListing,
  series: ReportSeries | null,
  baseline: ReportSeries | null,
  historical: ReportSeries | null,
  /** Only the effects of actions the viewer may see */
  effects: ReportEffect[],
};

export type ReportRoadmap = {
  id: string,
  name: string,
  description: string,
  type: RoadmapType,
  actor: string | null,
  geoAreaName: string | null,
  sharing: Sharing,
  /** The version the report shows (see `currentIteration`); null when the viewer sees no version of the roadmap */
  iteration: {
    id: string,
    version: number,
    status: IterationStatus,
    description: string | null,
    /** ISO timestamp */
    updatedAt: string,
    /** Unlisted goals left out of `goals`; only ever counted for those who can edit them */
    unlistedLeftOut: number,
  } | null,
  goals: ReportGoal[],
};

/** A goal an action has an effect on, as the action's entry names it */
export type ReportLinkedGoal = {
  id: string,
  name: string | null,
  indicatorParameter: string,
  roadmap: { id: string, name: string },
  version: number,
};

export type OrgReport = {
  /** The org's listed roadmaps the viewer may read, in the roadmap lists' order, each with its current version's goals */
  roadmaps: ReportRoadmap[],
  /** Every version of those roadmaps the viewer may see, by id: where an action of the org belongs */
  iterations: Record<string, { roadmapId: string, roadmapName: string, version: number, current: boolean }>,
  /** The goals each of the org's actions has an effect on, by action id */
  linkedGoals: Record<string, ReportLinkedGoal[]>,
};

const nothing: OrgReport = { roadmaps: [], iterations: {}, linkedGoals: {} };

/**
 * Everything of an org's roadmaps, goals and effects that its report prints, over what the
 * requesting user may read: the same access filters as the lists, applied in the queries.
 * The org's actions themselves come from `getActionSummaries`, like on the landing.
 *
 * Unlisted goals are left out for everyone, as in the counts next to the roadmap lists;
 * `includeUnlisted` adds the ones the viewer can edit (it gives nothing to anyone else).
 * @param options.asVisitor What a visitor without a login gets, whoever asks (the public version)
 */
export async function getOrgReport(orgId: string, options: { asVisitor?: boolean, includeUnlisted?: boolean } = {}): Promise<OrgReport> {
  const accessContext = options.asVisitor ? null : await getUserAccessContext();
  return uncachedFallback(
    () => getCachedOrgReport(orgId, accessContext, !!options.includeUnlisted),
    nothing,
    "Error fetching org report",
    { orgId },
  );
}

const plottedSeriesSelection = {
  unit: true,
  values: {
    select: { timestamp: true, value: true },
    orderBy: { timestamp: "asc" },
  },
} satisfies Prisma.DataSeriesSelect;

function toReportSeries(series: Prisma.DataSeriesGetPayload<{ select: typeof plottedSeriesSelection }> | null): ReportSeries | null {
  if (!series) return null;
  return {
    unit: series.unit,
    points: series.values
      .filter(record => Number.isFinite(record.value))
      .map(record => [record.timestamp.getUTCFullYear(), record.value]),
  };
}

/**
 * A fixed handful of statements whatever the number of goals: the roadmaps with their
 * versions, the chosen versions with goals, series and effects, and the action-to-goal links.
 */
async function getCachedOrgReport(orgId: string, accessContext: UserAccessContext | null, includeUnlisted: boolean): Promise<OrgReport> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action', 'dataSeries', 'org');

  return boundedFill("getCachedOrgReport", async () => {
    const listedRoadmap = listedRoadmapsWHERE(accessContext, HiddenRoadmaps.Exclude);
    const visibleIteration = visibleRoadmapIterationsWHERE(accessContext);
    // `listedGoalsWHERE` only lets unlisted goals through under a roadmap the viewer can write to
    const reportedGoal: Prisma.GoalsWhereInput = includeUnlisted
      ? listedGoalsWHERE(accessContext)
      : { listing: { not: GoalListing.UNLISTED } };

    const roadmaps = await prisma.roadmaps.findMany({
      where: {
        AND: [
          { access_control: { AND: [{ org_id: orgId }, readableAccessControlWHERE(accessContext)] } },
          listedRoadmap,
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        actor: true,
        geo_area: { select: { name: true } },
        access_control: { select: { sharing: true } },
        iterations: { where: visibleIteration, select: { id: true, version: true, status: true } },
      },
    });
    roadmaps.sort(roadmapSorter);

    const current = new Map(roadmaps.flatMap(roadmap => {
      const iteration = currentIteration(roadmap.iterations);
      return iteration ? [[roadmap.id, iteration.id] as const] : [];
    }));

    const [versions, effects] = await Promise.all([
      prisma.roadmapIterations.findMany({
        // The ids come from the access-filtered query above; the filter is repeated rather than trusted
        where: { AND: [visibleIteration, { id: { in: [...current.values()] } }] },
        select: {
          id: true,
          version: true,
          status: true,
          description: true,
          updated_at: true,
          _count: {
            select: {
              goals: { where: includeUnlisted ? { id: { in: [] } } : { AND: [listedGoalsWHERE(accessContext), { listing: GoalListing.UNLISTED }] } },
            },
          },
          goals: {
            where: reportedGoal,
            select: {
              id: true,
              name: true,
              description: true,
              indicator_parameter: true,
              listing: true,
              data_series: { select: plottedSeriesSelection },
              baseline: { select: plottedSeriesSelection },
              historical: { select: plottedSeriesSelection },
              effects: {
                where: visibleEffectsWHERE(accessContext),
                select: {
                  impact_type: true,
                  data_series: { select: plottedSeriesSelection },
                  action: { select: { id: true, name: true, start_year: true, end_year: true } },
                },
              },
            },
          },
        },
      }),
      // Which goals the org's listed actions act on, among the goals the report could show
      prisma.effects.findMany({
        where: {
          action: listedActionsWHERE(accessContext, orgId),
          goal: { AND: [reportedGoal, { roadmap_iteration: { AND: [visibleIteration, { roadmap: listedRoadmap }] } }] },
        },
        select: {
          action_id: true,
          goal: {
            select: {
              id: true,
              name: true,
              indicator_parameter: true,
              roadmap_iteration: { select: { version: true, roadmap: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
    ]);
    const versionById = new Map(versions.map(version => [version.id, version]));

    const linkedGoals: OrgReport["linkedGoals"] = {};
    for (const effect of effects) {
      (linkedGoals[effect.action_id] ??= []).push({
        id: effect.goal.id,
        name: effect.goal.name,
        indicatorParameter: effect.goal.indicator_parameter,
        roadmap: effect.goal.roadmap_iteration.roadmap,
        version: effect.goal.roadmap_iteration.version,
      });
    }
    for (const goals of Object.values(linkedGoals)) {
      goals.sort((a, b) => goalSorter({ name: a.name, indicator_parameter: a.indicatorParameter }, { name: b.name, indicator_parameter: b.indicatorParameter }));
    }

    return {
      roadmaps: roadmaps.map(roadmap => {
        const version = versionById.get(current.get(roadmap.id) ?? "");
        return {
          id: roadmap.id,
          name: roadmap.name,
          description: roadmap.description,
          type: roadmap.type,
          actor: roadmap.actor,
          geoAreaName: roadmap.geo_area?.name ?? null,
          sharing: roadmap.access_control.sharing,
          iteration: version
            ? {
              id: version.id,
              version: version.version,
              status: version.status,
              description: version.description,
              updatedAt: version.updated_at.toISOString(),
              unlistedLeftOut: version._count.goals,
            }
            : null,
          goals: (version?.goals ?? [])
            .sort(goalSorter)
            // Featured goals lead, as on the roadmap's own page
            .sort((a, b) => Number(b.listing === GoalListing.FEATURED) - Number(a.listing === GoalListing.FEATURED))
            .map(goal => ({
              id: goal.id,
              name: goal.name,
              description: goal.description,
              indicatorParameter: goal.indicator_parameter,
              listing: goal.listing,
              series: toReportSeries(goal.data_series),
              baseline: toReportSeries(goal.baseline),
              historical: toReportSeries(goal.historical),
              effects: goal.effects
                .map(effect => ({
                  impactType: effect.impact_type,
                  series: toReportSeries(effect.data_series),
                  action: { id: effect.action.id, name: effect.action.name, startYear: effect.action.start_year, endYear: effect.action.end_year },
                }))
                .sort((a, b) => a.action.name.localeCompare(b.action.name, "sv")),
            })),
        };
      }),
      iterations: Object.fromEntries(roadmaps.flatMap(roadmap => roadmap.iterations.map(iteration => [
        iteration.id,
        { roadmapId: roadmap.id, roadmapName: roadmap.name, version: iteration.version, current: current.get(roadmap.id) === iteration.id },
      ]))),
      linkedGoals,
    };
  });
}
