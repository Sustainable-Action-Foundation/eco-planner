import CuratedHistoricalGraph from "@/components/graph/graphs/curatedHistoricalGraph";
import { getNationalGoalMatches } from "@/fetchers/getNationalGoalMatches";
import { goalDisplayName, indicatorParameterContext } from "@/functions/goalName";
import { formatSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import serveTea from "@/lib/i18nServer";
import { IconArrowRight, IconInfoCircle } from "@tabler/icons-react";
import Link from "next/link";
import type { CuratedGeoArea } from "@/fetchers/getCuratedHistoricalData";
import type { NationalGoalMatch } from "@/fetchers/getNationalGoalMatches";

/**
 * The org landing page's national goals to adopt: goals in the national
 * scenarios that the curated catalog can measure in the org's own area, each
 * offering to copy the goal into one of the org's roadmaps with the local
 * series as its historical data and as the share the national goal is scaled
 * by (see `getGoalPrefill`). Renders nothing when nothing matches, so callers
 * can include it unconditionally.
 */
export default async function NationalGoals({
  orgId,
  geoArea,
  canCreateGoals,
}: {
  /** The org the copies are for; its geo area localizes the series */
  orgId: string,
  geoArea: CuratedGeoArea,
  /** Whether the user can add goals to one of the org's roadmaps; otherwise the section points to creating a roadmap first */
  canCreateGoals: boolean,
}) {
  const t = await serveTea(["pages", "common"]);
  const matches = await getNationalGoalMatches(t, geoArea);

  if (matches.length === 0) return null;

  // One group per roadmap version, in fetch order
  const groups: { roadmap: NationalGoalMatch["roadmap"], matches: NationalGoalMatch[] }[] = [];
  for (const match of matches) {
    const group = groups.find(group => group.roadmap.iterationId === match.roadmap.iterationId);
    if (group) group.matches.push(match);
    else groups.push({ roadmap: match.roadmap, matches: [match] });
  }

  return <>
    <h2 className="margin-top-0 margin-bottom-50 font-weight-600">
      {t("pages:home.national_goals.title", { area: geoArea.name })}
    </h2>
    <p className="margin-top-0 margin-bottom-100 color-gray">
      {t("pages:home.national_goals.description")}
    </p>

    {!canCreateGoals ?
      <p className="flex gap-50 align-items-center margin-top-0 margin-bottom-100 padding-50 smooth" style={{ border: '1px solid var(--gray-80)' }}>
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>
          {t("pages:home.national_goals.no_roadmap")}{" "}
          <Link href="/roadmap/create">{t("pages:home.national_goals.create_roadmap")}</Link>
        </span>
      </p>
      : null}

    {groups.map(group => (
      <section key={group.roadmap.iterationId} className="margin-bottom-100">
        <h3 className="margin-top-0 margin-bottom-50 font-weight-500" style={{ fontSize: '1.25rem' }}>
          {t("common:roadmap_version_name", { name: group.roadmap.name, version: group.roadmap.version })}
        </h3>
        <ul
          className="margin-0 padding-0"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', listStyle: 'none' }}
        >
          {group.matches.map(match => <GoalCard key={match.goal.id} match={match} orgId={orgId} canCreateGoals={canCreateGoals} area={geoArea.name} />)}
        </ul>
      </section>
    ))}
  </>;
}

async function GoalCard({ match, orgId, canCreateGoals, area }: { match: NationalGoalMatch, orgId: string, canCreateGoals: boolean, area: string }) {
  const t = await serveTea(["pages", "common"]);
  const { goal, entry, series } = match;

  const name = goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter });
  const context = indicatorParameterContext(goal.indicatorParameter);
  // A multi-series entry's series are only distinct together with the entry
  const seriesName = `${entry.name}${series.name !== entry.name ? `: ${series.name}` : ""}`;
  const latest = Object.entries(series.dateValues).sort(([a], [b]) => a.localeCompare(b)).at(-1);

  const ref = encodeURIComponent(formatSeriesRef({ kind: SeriesRefKind.Curated, entryKey: entry.key, seriesKey: series.key }));
  const href = `/goal/create?org=${encodeURIComponent(orgId)}&series=${ref}&from=${encodeURIComponent(goal.id)}`;

  return (
    <li className="smooth" style={{ border: '1px solid var(--gray-80)' }}>
      <article className="padding-50 height-100 flex flex-direction-column">
        <h4 className="margin-block-25 font-weight-500">
          <Link href={`/goal/${goal.id}`} className="color-pureblack">{name}</Link>
        </h4>
        {context ? <small className="color-gray margin-bottom-25">{context}</small> : null}
        <CuratedHistoricalGraph
          series={[{ name: t("pages:home.national_goals.national_goal"), dateValues: goal.dateValues }]}
          unit={goal.unit}
        />
        <p className="margin-block-25 font-size-14px color-gray flex-grow-100">
          {t("pages:home.national_goals.local_series", { series: seriesName, area })}
          {latest ? ` ${t("pages:home.national_goals.latest_value", {
            value: latest[1].toLocaleString("sv-SE"),
            unit: entry.unit ?? "",
            year: new Date(latest[0]).getFullYear(),
          })}` : null}
        </p>
        {canCreateGoals ?
          <Link
            href={href}
            className="margin-top-50 font-size-14px font-weight-500 display-inline-flex align-items-center gap-25"
            style={{ alignSelf: 'flex-start' }}
          >
            {t("pages:home.national_goals.copy")}
            <IconArrowRight aria-hidden="true" width={16} height={16} style={{ minWidth: '16px' }} />
          </Link>
          : null}
      </article>
    </li>
  );
}
