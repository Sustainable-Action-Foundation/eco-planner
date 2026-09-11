import { getCuratedHistoricalEntries } from "@/fetchers/getCuratedHistoricalData";
import { findLocalSeries } from "@/fetchers/getNationalGoalMatches";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { getNationalGoalMappings } from "@/lib/curatedHistoricalData";
import { formatSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import serveTea from "@/lib/i18nServer";
import { RoadmapType } from "@/lib/prisma/generated";
import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";

/**
 * The way from a goal into one of the user's own roadmaps: a copy started
 * from this goal (its series is what the suggested methods scale, its fields
 * seed the form; see `getGoalPrefill`). A national goal the curated catalog
 * can measure locally instead gets one link per org of the user's with a geo
 * area and data for the statistic, the same copy link as the org landing
 * page's card. Renders nothing when the user has nowhere to put a copy.
 */
export default async function UseGoalInRoadmap({
  goal,
  roadmapType,
  canCreateGoals,
}: {
  goal: { id: string, indicator_parameter: string },
  roadmapType: RoadmapType,
  /** Whether the user can add goals to some roadmap version */
  canCreateGoals: boolean,
}) {
  if (!canCreateGoals) return null;
  const t = await serveTea(["pages", "common"]);

  const local = roadmapType === RoadmapType.NATIONAL ? await localTargets(goal, t) : [];
  const href = `/goal/create?from=${encodeURIComponent(goal.id)}`;

  return (
    <section className="margin-block-100 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }}>
      <h2 className="margin-top-0 margin-bottom-25 font-weight-600" style={{ fontSize: '1.25rem' }}>
        {local.length > 0 ? t("pages:goal.use_locally.heading") : t("pages:goal.use_in_roadmap.heading")}
      </h2>
      <p className="margin-top-0 margin-bottom-100 color-gray">
        {local.length > 0
          ? t("pages:goal.use_locally.description", { series: local[0].seriesName })
          : t("pages:goal.use_in_roadmap.description")}
      </p>
      <div className="flex gap-50 flex-wrap-wrap">
        {local.length > 0
          ? local.map(target => (
            <Link key={target.orgId} className="button round color-purewhite seagreen font-weight-500 display-inline-flex align-items-center gap-50" href={target.href}>
              {local.length > 1 ? t("pages:goal.use_locally.link_org", { org: target.orgName }) : t("pages:goal.use_locally.link")}
              <IconArrowRight aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
            </Link>
          ))
          : (
            <Link className="button round color-purewhite seagreen font-weight-500 display-inline-flex align-items-center gap-50" href={href}>
              {t("pages:goal.use_locally.link")}
              <IconArrowRight aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
            </Link>
          )}
      </div>
    </section>
  );
}

/** For a mapped national goal: the user's orgs whose area the statistic has data for, each with its copy link. */
async function localTargets(goal: { id: string, indicator_parameter: string }, t: Awaited<ReturnType<typeof serveTea>>) {
  const mapping = getNationalGoalMappings().find(mapping => mapping.indicatorParameter === goal.indicator_parameter);
  if (!mapping) return [];

  const orgs = (await getUserOrgs()).filter(org => org.isMember && !org.isGuest && org.geoArea);
  const targets = await Promise.all(orgs.map(async org => {
    if (!org.geoArea) return null;
    const entries = await getCuratedHistoricalEntries(t, org.geoArea, mapping.series.map(candidate => candidate.entryKey));
    const local = findLocalSeries(mapping, entries);
    if (!local) return null;
    const ref = formatSeriesRef({ kind: SeriesRefKind.Curated, entryKey: local.entry.key, seriesKey: local.series.key });
    // A multi-series entry's series are only distinct together with the entry
    const seriesName = local.entry.series.length > 1 ? `${local.entry.name}: ${local.series.name}` : local.entry.name;
    return {
      orgId: org.id,
      orgName: org.name,
      seriesName,
      href: `/goal/create?org=${encodeURIComponent(org.id)}&series=${encodeURIComponent(ref)}&from=${encodeURIComponent(goal.id)}`,
    };
  }));
  return targets.filter(target => target !== null);
}
