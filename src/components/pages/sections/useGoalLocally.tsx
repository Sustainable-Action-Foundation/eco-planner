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
 * On a national goal the curated catalog can measure locally: the way into
 * the user's own roadmaps, one link per org of theirs with a geo area, each
 * the same copy link as the org landing page's card (see `getGoalPrefill`).
 * Renders nothing for other goals, orgs without an area, or areas the
 * statistic has no data for, so callers can include it unconditionally.
 */
export default async function UseGoalLocally({
  goal,
  roadmapType,
}: {
  goal: { id: string, indicator_parameter: string },
  roadmapType: RoadmapType,
}) {
  if (roadmapType !== RoadmapType.NATIONAL) return null;
  const mapping = getNationalGoalMappings().find(mapping => mapping.indicatorParameter === goal.indicator_parameter);
  if (!mapping) return null;

  const [t, userOrgs] = await Promise.all([serveTea(["pages", "common"]), getUserOrgs()]);
  const orgs = userOrgs.filter(org => org.isMember && !org.isGuest && org.geoArea);

  const targets = (await Promise.all(orgs.map(async org => {
    if (!org.geoArea) return null;
    const entries = await getCuratedHistoricalEntries(t, org.geoArea, mapping.series.map(candidate => candidate.entryKey));
    const local = findLocalSeries(mapping, entries);
    if (!local) return null;
    const ref = formatSeriesRef({ kind: SeriesRefKind.Curated, entryKey: local.entry.key, seriesKey: local.series.key });
    // A multi-series entry's series are only distinct together with the entry
    const seriesName = local.entry.series.length > 1 ? `${local.entry.name}: ${local.series.name}` : local.entry.name;
    return {
      org,
      seriesName,
      href: `/goal/create?org=${encodeURIComponent(org.id)}&series=${encodeURIComponent(ref)}&from=${encodeURIComponent(goal.id)}`,
    };
  }))).filter(target => target !== null);

  if (targets.length === 0) return null;

  return (
    <section className="margin-block-100 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }}>
      <h2 className="margin-top-0 margin-bottom-25 font-weight-600" style={{ fontSize: '1.25rem' }}>
        {t("pages:goal.use_locally.heading")}
      </h2>
      <p className="margin-top-0 margin-bottom-100 color-gray">
        {t("pages:goal.use_locally.description", { series: targets[0].seriesName })}
      </p>
      <div className="flex gap-50 flex-wrap-wrap">
        {targets.map(target => (
          <Link key={target.org.id} className="button round color-purewhite pureblack font-weight-500 display-inline-flex align-items-center gap-50" href={target.href}>
            {targets.length > 1 ? t("pages:goal.use_locally.link_org", { org: target.org.name }) : t("pages:goal.use_locally.link")}
            <IconArrowRight aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          </Link>
        ))}
      </div>
    </section>
  );
}
