import "server-only";
import StaticRichText from "@/components/generic/richText/staticRichText";
import SharingLine from "@/components/generic/visibility/sharingLine";
import VisibilityBadges from "@/components/generic/visibility/visibilityBadges";
import { calculatePredictedOutcome } from "@/components/graph/functions/graphFunctions";
import { unitConverter, unitRelation } from "@/components/graph/functions/seriesUnits";
import { graphNumberFormatter } from "@/components/graph/functions/tickLabels";
import StaticGoalGraph, { StaticSeriesKind } from "@/components/graph/graphs/staticGoalGraph";
import type { StaticSeries } from "@/components/graph/graphs/staticGoalGraph";
import { KeyNumbers } from "@/components/pages/orgLanding/overview";
import ProcessBar from "@/components/pages/orgLanding/processBar";
import { OrgFacts } from "@/components/pages/orgLanding/publicView";
import { getActionSummaries } from "@/fetchers";
import { getOrgReport } from "@/fetchers/getOrgReport";
import type { OrgReport as OrgReportContent, ReportGoal, ReportRoadmap, ReportSeries } from "@/fetchers/getOrgReport";
import type { OrgProfile } from "@/fetchers/getOrgProfile";
import { ActionFieldHeaders, actionFieldLabel, getActionDescription, groupActionFields } from "@/functions/fields";
import { goalDisplayName, indicatorParameterContext } from "@/functions/goalName";
import { orgBannerPath } from "@/functions/orgBanner";
import { cssStringLiteral, keyYears } from "@/functions/orgReport";
import { orgTypeLabel } from "@/functions/orgTypeLabel";
import { parseUnit } from "@/functions/unit";
import { iterationPath } from "@/functions/versionSlug";
import serveTea from "@/lib/i18nServer";
import { ActionFieldType, ActionImpactType, GeoAreaType, RoadmapType } from "@/lib/prisma/generated";
import type { ActionSummary, PlottedSeries, Roadmap, Unit } from "@/types";
import { UnitFlags } from "@/types/enums";
import type { TFunction } from "i18next";
import Image from "next/image";
import styles from "./orgReport.module.css" with { type: "css" };

const namespaces = ["pages", "common", "graphs", "forms", "components"];

/**
 * An org's whole content as one document, laid out for A4: who the org is, the landing's
 * key numbers and process, every roadmap's current version with its goals (graph, key
 * years, the actions acting on it), and the org's actions. Everything is fetched as the
 * viewer (or as a visitor without a login, for the public version), by the loaders the
 * landing uses plus `getOrgReport`; nothing here decides access.
 *
 * Nothing streams: the page prints, so the document must be whole when it arrives.
 */
export default async function OrgReport({ org, roadmaps, asVisitor, includeUnlisted, exportedAt }: {
  org: OrgProfile,
  /** The org's listed roadmaps as the viewer sees them (the landing's own list) */
  roadmaps: Roadmap[],
  /** The public version: what a visitor without a login gets, whoever asks */
  asVisitor: boolean,
  /** Unlisted goals too, for those who can edit them */
  includeUnlisted: boolean,
  exportedAt: Date,
}) {
  const [t, report, actions] = await Promise.all([
    serveTea(namespaces),
    getOrgReport(org.id, { asVisitor, includeUnlisted }),
    getActionSummaries(org.id, { asVisitor }),
  ]);

  const county = org.geoArea?.type === GeoAreaType.MUNICIPALITY && org.geoArea.parent?.type === GeoAreaType.COUNTY ? org.geoArea.parent : null;
  // Sweden's calendar date whatever the server's time zone, in the one format every locale reads the same
  const exportedDay = exportedAt.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
  // A page name of its own, so the paper size, margins and running footer apply to this
  // document only: routes stay mounted after navigation, and an unnamed @page rule
  // would follow the visitor to whatever they print next
  const pageName = `org-report-${org.id.replace(/[^0-9a-z]/gi, "")}`;
  const goalIds = new Set(report.roadmaps.flatMap(roadmap => roadmap.goals.map(goal => goal.id)));
  const actionIds = new Set(actions.map(action => action.id));

  return (
    <article className={styles.document} style={{ page: pageName }} data-testid="org-report" data-view={asVisitor ? "PUBLIC" : "VIEWER"} data-goals={goalIds.size}>
      <style dangerouslySetInnerHTML={{
        __html: `
          @page ${pageName} {
            size: A4;
            margin: 15mm 15mm 18mm;
            @bottom-left { content: ${cssStringLiteral(`${org.name} · ${exportedDay}`)}; font: 9pt system-ui, sans-serif; color: #444; }
            @bottom-right { content: counter(page) " / " counter(pages); font: 9pt system-ui, sans-serif; color: #444; }
          }
      `}} />

      <header className={styles.cover}>
        {org.bannerUpdatedAt ?
          <div className={styles.banner}>
            {/* Unoptimized: the route sets its own cache headers per banner version */}
            <Image src={orgBannerPath(org.id, org.bannerUpdatedAt)} alt="" fill={true} unoptimized={true} priority={true} style={{ objectFit: 'cover' }} data-testid="org-report-banner" />
          </div>
          : null}
        <p className={styles.kicker}>{t("pages:org_report.cover.kicker")}</p>
        <h1 data-testid="org-report-title">{org.name}</h1>
        {org.orgType || org.geoArea ?
          <p className={styles.meta} data-testid="org-report-tags">
            {[
              org.orgType ? orgTypeLabel(t, org.orgType) : null,
              org.geoArea
                ? (org.geoArea.type === GeoAreaType.MUNICIPALITY
                  ? t("pages:org_landing.area_municipality", { area: org.geoArea.name })
                  : t("pages:org_landing.area", { area: org.geoArea.name }))
                : null,
              county?.name,
            ].filter(Boolean).join(" · ")}
          </p>
          : null}
        <p className={styles.meta}>
          <time dateTime={exportedAt.toISOString()} data-testid="org-report-date">
            {t("pages:org_report.cover.exported", { date: exportedAt, formatParams: { date: { dateStyle: "long", timeZone: "Europe/Stockholm" } } })}
          </time>
          {" · "}
          <span data-testid="org-report-version">
            {asVisitor ? t("pages:org_report.cover.public_version") : t("pages:org_report.cover.viewer_version")}
          </span>
        </p>

        <div className={styles.about}>
          <div>
            <h2>{t("pages:org_landing.public.about_title")}</h2>
            {org.description
              ? <p style={{ whiteSpace: 'pre-line' }} data-testid="org-report-description">{org.description}</p>
              : <p className={styles.muted}>{t("pages:org_landing.public.about_empty", { org: org.name })}</p>}
          </div>
          <OrgFacts org={org} asVisitor={asVisitor} />
        </div>

        <nav className={styles.contents} aria-labelledby="org-report-contents-title">
          <h2 id="org-report-contents-title">{t("pages:org_report.cover.contents")}</h2>
          <ol>
            <li><a href="#org-report-summary">{t("pages:org_report.summary.title")}</a></li>
            {report.roadmaps.map(roadmap => (
              <li key={roadmap.id}>
                <a href={`#roadmap-${roadmap.id}`}>{roadmap.name}</a>
                {roadmap.iteration ? <span className={styles.muted}> · {t("common:count.goal", { count: roadmap.goals.length })}</span> : null}
              </li>
            ))}
            <li>
              <a href="#org-report-actions">{t("pages:org_landing.tabs.actions")}</a>
              <span className={styles.muted}> · {t("common:count.action", { count: actions.length })}</span>
            </li>
          </ol>
        </nav>
      </header>

      <section id="org-report-summary" className={styles.summary} aria-label={t("pages:org_report.summary.title")} data-testid="org-report-summary">
        <div>
          <KeyNumbers org={org} allRoadmaps={roadmaps} asVisitor={asVisitor} />
        </div>
        <div>
          <ProcessBar orgId={org.id} areaName={org.geoArea?.name ?? null} focusStep={org.focusStep} focusPeriod={org.focusPeriod} asVisitor={asVisitor} working={false} />
        </div>
      </section>

      {report.roadmaps.length === 0 ?
        <section className={styles.roadmap} data-testid="org-report-no-roadmaps">
          <h2>{t("pages:home.title")}</h2>
          <p className={styles.muted}>{t("pages:org_landing.public.plans_empty", { org: org.name })}</p>
        </section>
        : null}
      {report.roadmaps.map(roadmap => (
        <ReportRoadmapSection key={roadmap.id} t={t} orgName={org.name} roadmap={roadmap} actionIds={actionIds} />
      ))}

      <ReportActions t={t} report={report} actions={actions} goalIds={goalIds} />
    </article>
  );
}

function roadmapTypeLabel(t: TFunction, type: RoadmapType): string {
  const labels: Record<RoadmapType, string> = {
    [RoadmapType.NATIONAL]: t("common:scope.national_roadmap"),
    [RoadmapType.REGIONAL]: t("common:scope.regional_roadmap"),
    [RoadmapType.MUNICIPAL]: t("common:scope.municipal_roadmap"),
    [RoadmapType.LOCAL]: t("common:scope.local_roadmap"),
    [RoadmapType.ORGANIZATIONAL]: t("common:scope.organizational_roadmap"),
    [RoadmapType.OTHER]: t("common:scope.other_roadmap"),
  };
  return labels[type];
}

/** One roadmap, from a new page: what it is, then the goals of its current version */
function ReportRoadmapSection({ t, orgName, roadmap, actionIds }: { t: TFunction, orgName: string, roadmap: ReportRoadmap, actionIds: Set<string> }) {
  const iteration = roadmap.iteration;

  return (
    <section id={`roadmap-${roadmap.id}`} className={styles.roadmap} data-testid="org-report-roadmap" data-roadmap={roadmap.id} data-goals={roadmap.goals.length}>
      <header>
        <p className={styles.kicker}>
          {[roadmapTypeLabel(t, roadmap.type), roadmap.geoAreaName, roadmap.actor].filter(Boolean).join(" · ")}
        </p>
        <h2>
          {iteration
            ? <a href={iterationPath(roadmap.id, iteration.version)}>{roadmap.name}</a>
            : <a href={`/roadmap/${roadmap.id}`}>{roadmap.name}</a>}
        </h2>
        <p className={styles.meta}>
          {iteration ? <>
            <span>{t("pages:roadmap_iteration.version", { version: iteration.version })}</span>
            <VisibilityBadges status={iteration.status} />
            <span>{t("common:count.goal", { count: roadmap.goals.length })}</span>
            <span>{t("pages:org_report.roadmap.updated", { date: new Date(iteration.updatedAt), formatParams: { date: { dateStyle: "medium", timeZone: "Europe/Stockholm" } } })}</span>
          </> : null}
          <SharingLine accessControl={{ sharing: roadmap.sharing, org: { name: orgName } }} />
        </p>
      </header>

      <StaticRichText content={roadmap.description} className={styles.description} />
      <StaticRichText content={iteration?.description} className={styles.description} />

      {!iteration ?
        <p className={styles.muted} data-testid="org-report-no-version">{t("pages:org_report.roadmap.no_version")}</p>
        : null}
      {iteration && roadmap.goals.length === 0 ?
        <p className={styles.muted} data-testid="org-report-no-goals">{t("pages:org_report.roadmap.no_goals")}</p>
        : null}
      {iteration && iteration.unlistedLeftOut > 0 ?
        <p className={styles.note} data-testid="org-report-unlisted-left-out">{t("pages:org_report.roadmap.unlisted_left_out", { count: iteration.unlistedLeftOut })}</p>
        : null}

      {roadmap.goals.map(goal => <ReportGoalBlock key={goal.id} t={t} goal={goal} actionIds={actionIds} />)}
    </section>
  );
}

function unitLabel(t: TFunction, unit: Unit): string {
  if (unit === UnitFlags.Missing) return t("common:tsx.unit_missing");
  if (unit === UnitFlags.Unitless) return t("common:tsx.unitless");
  return unit;
}

/** A report series as the graph functions take it: one value per year, at the year's first day */
function toPlottedSeries(series: ReportSeries): PlottedSeries {
  return { unit: series.unit, values: series.points.map(([year, value]) => ({ timestamp: new Date(Date.UTC(year, 0, 1)), value })) };
}

/** One goal, kept on one page: what it measures, its graph, the key years in numbers and the actions acting on it */
function ReportGoalBlock({ t, goal, actionIds }: { t: TFunction, goal: ReportGoal, actionIds: Set<string> }) {
  const mainUnit = parseUnit((goal.series ?? goal.baseline ?? goal.historical)?.unit);
  const context = indicatorParameterContext(goal.indicatorParameter);

  // Historical data comes from elsewhere and may be in another unit of the same quantity;
  // it is converted when it can be, and the mismatch is said out loud when it can't (as on the goal page)
  const historicalUnit = parseUnit(goal.historical?.unit);
  const historicalMismatch = !!goal.series && !!goal.historical && unitRelation(historicalUnit, mainUnit) === "mismatch";
  const convertHistorical = goal.series ? unitConverter(historicalUnit, mainUnit) : (value: number) => value;

  // What the effects of the linked actions add up to, as on the goal page
  const predictedOutcome: [number, number][] = goal.effects.length > 0
    ? calculatePredictedOutcome(
      goal.effects.map(effect => ({ impact_type: effect.impactType, data_series: effect.series ? toPlottedSeries(effect.series) : null })),
      goal.baseline ? toPlottedSeries(goal.baseline) : null,
    ).flatMap(point => point.y === null ? [] : [[new Date(point.x).getUTCFullYear(), point.y] as [number, number]])
    : [];

  const series: StaticSeries[] = [
    ...(goal.series ? [{ kind: StaticSeriesKind.Main, name: t("graphs:graph_selector.goal"), points: goal.series.points }] : []),
    ...(goal.baseline ? [{ kind: StaticSeriesKind.Baseline, name: t("graphs:common.baseline_scenario"), points: goal.baseline.points }] : []),
    ...(goal.historical ? [{ kind: StaticSeriesKind.Historical, name: t("pages:org_report.goal.historical"), points: goal.historical.points.map(([year, value]): [number, number] => [year, convertHistorical(value)]) }] : []),
    ...(predictedOutcome.length > 0 ? [{ kind: StaticSeriesKind.PredictedOutcome, name: t("graphs:common.expected_outcome"), points: predictedOutcome }] : []),
  ].filter(candidate => candidate.points.length > 0);

  // The goal's own years set the table (as many rows as fit beside the graph: more would
  // cost a goal per page); the latest year with history is always in it
  const planned = series.filter(candidate => candidate.kind !== StaticSeriesKind.Historical);
  const historical = series.find(candidate => candidate.kind === StaticSeriesKind.Historical);
  const years = keyYears(
    (planned.length > 0 ? planned : series).flatMap(candidate => candidate.points.map(([year]) => year)),
    { always: historical && planned.length > 0 ? [historical.points[historical.points.length - 1][0]] : [] },
  );
  const valueByYear = new Map(series.map(candidate => [candidate.kind, new Map(candidate.points)]));

  const impactTypeLabels: Record<ActionImpactType, string> = {
    [ActionImpactType.ABSOLUTE]: t("forms:effect.impact_types.absolute"),
    [ActionImpactType.DELTA]: t("forms:effect.impact_types.delta"),
    [ActionImpactType.PERCENT]: t("forms:effect.impact_types.percent"),
  };

  return (
    <section id={`goal-${goal.id}`} className={styles.goal} data-testid="org-report-goal" data-goal={goal.id}>
      <h3>
        <a href={`/goal/${goal.id}`}>{goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter })}</a>
        <VisibilityBadges listing={goal.listing} />
      </h3>
      <p className={styles.meta}>
        {context ? <span>{t("pages:org_report.goal.indicator", { indicator: context })}</span> : null}
        <span>{t("pages:org_report.goal.unit", { unit: unitLabel(t, mainUnit) })}</span>
      </p>
      <StaticRichText content={goal.description} className={styles.description} />

      {series.length === 0 ?
        <p className={styles.muted} data-testid="org-report-goal-no-data">{t("pages:org_report.goal.no_data")}</p>
        :
        <div className={styles.goalData}>
          <StaticGoalGraph
            series={series}
            unitLabel={unitLabel(t, mainUnit)}
            label={t("pages:org_report.goal.graph_label", { goal: goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter }) })}
          />
          <table className={styles.years} data-testid="org-report-goal-years">
            <thead>
              <tr>
                <th scope="col">{t("pages:org_report.goal.year")}</th>
                {series.map(candidate => <th key={candidate.kind} scope="col">{candidate.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {years.map(year => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  {series.map(candidate => {
                    const value = valueByYear.get(candidate.kind)?.get(year);
                    return <td key={candidate.kind}>{value === undefined ? "" : graphNumberFormatter(value)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      {historicalMismatch ?
        <p className={styles.footnote}>
          {t("graphs:common.historical_unit_mismatch", { historical: unitLabel(t, historicalUnit), goal: unitLabel(t, mainUnit) })}
        </p>
        : null}

      {goal.effects.length > 0 ?
        <div className={styles.effects} data-testid="org-report-goal-effects">
          <h4>{t("pages:org_report.goal.effects_title")}</h4>
          <ul>
            {goal.effects.map(effect => (
              <li key={effect.action.id}>
                {/* The action's own entry further down when the org owns it, else its page */}
                <a href={actionIds.has(effect.action.id) ? `#action-${effect.action.id}` : `/action/${effect.action.id}`}>{effect.action.name}</a>
                {effect.action.startYear && effect.action.endYear ? <span> ({effect.action.startYear}–{effect.action.endYear})</span> : null}
                <span className={styles.muted}> · {impactTypeLabels[effect.impactType]}</span>
              </li>
            ))}
          </ul>
        </div>
        : null}
    </section>
  );
}

/**
 * The org's actions, once each and in full: those of each roadmap's current version, then
 * the ones without a roadmap (the shared action database). Actions of superseded versions
 * are only named, so the count matches the action list without repeating what the current
 * version already says. Goals refer here instead of repeating the actions' details.
 */
function ReportActions({ t, report, actions, goalIds }: { t: TFunction, report: OrgReportContent, actions: ActionSummary[], goalIds: Set<string> }) {
  const byName = (a: ActionSummary, b: ActionSummary) => a.name.localeCompare(b.name, "sv", { numeric: true });
  const inCurrentVersion = (roadmapId: string) => actions
    .filter(action => action.roadmap_iteration_id && report.iterations[action.roadmap_iteration_id]?.roadmapId === roadmapId && report.iterations[action.roadmap_iteration_id]?.current)
    .sort(byName);
  const groups = [
    ...report.roadmaps.map(roadmap => ({
      key: roadmap.id,
      title: t("pages:org_report.actions.in_roadmap", { roadmap: roadmap.name }),
      actions: inCurrentVersion(roadmap.id),
    })),
    { key: "none", title: t("pages:org_report.actions.without_roadmap"), actions: actions.filter(action => !action.roadmap_iteration_id).sort(byName) },
  ].filter(group => group.actions.length > 0);
  // Whatever is left sits in a version the report doesn't show
  const shown = new Set(groups.flatMap(group => group.actions.map(action => action.id)));
  const older = actions.filter(action => !shown.has(action.id)).sort(byName);

  return (
    <section id="org-report-actions" className={styles.actions} data-testid="org-report-actions">
      <h2>{t("pages:org_landing.tabs.actions")}</h2>
      {actions.length === 0 ? <p className={styles.muted} data-testid="org-report-no-actions">{t("pages:org_report.actions.none")}</p> : null}

      {groups.map(group => (
        <section key={group.key} data-testid="org-report-action-group">
          <h3>{group.title}</h3>
          {group.actions.map(action => {
            const description = getActionDescription(action.fields);
            const fields = groupActionFields(action.fields).filter(field => field.header !== ActionFieldHeaders.Description);
            const linked = report.linkedGoals[action.id] ?? [];
            return (
              <article key={action.id} id={`action-${action.id}`} className={styles.action} data-testid="org-report-action" data-action={action.id}>
                <h4>
                  <a href={`/action/${action.id}`}>{action.name}</a>
                  {action.start_year || action.end_year ? <span className={styles.period}>{action.start_year ?? ""}–{action.end_year ?? ""}</span> : null}
                </h4>
                {description ? <p style={{ whiteSpace: 'pre-line' }}>{description}</p> : null}
                {fields.length > 0 || linked.length > 0 ?
                  <dl className={styles.fields}>
                    {fields.map(field => (
                      <div key={field.header}>
                        <dt>{actionFieldLabel(field.header, t)}</dt>
                        <dd style={{ whiteSpace: field.type === ActionFieldType.PARAGRAPH ? 'pre-line' : undefined }}>
                          {field.type === ActionFieldType.PARAGRAPH ? field.values.join("\n\n") : field.values.join(", ")}
                        </dd>
                      </div>
                    ))}
                    {linked.length > 0 ?
                      <div data-testid="org-report-action-goals">
                        <dt>{t("pages:org_report.actions.linked_goals")}</dt>
                        <dd>
                          {linked.map((goal, index) => (
                            <span key={goal.id}>
                              {index > 0 ? ", " : null}
                              {/* The goal's own entry above when the report shows it, else its page */}
                              <a href={goalIds.has(goal.id) ? `#goal-${goal.id}` : `/goal/${goal.id}`}>{goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter })}</a>
                              {goalIds.has(goal.id) ? null : <span className={styles.muted}> ({t("common:roadmap_version_name", { name: goal.roadmap.name, version: goal.version })})</span>}
                            </span>
                          ))}
                        </dd>
                      </div>
                      : null}
                  </dl>
                  : null}
              </article>
            );
          })}
        </section>
      ))}

      {older.length > 0 ?
        <section data-testid="org-report-older-actions">
          <h3>{t("pages:org_report.actions.older_versions")}</h3>
          <ul className={styles.compact}>
            {older.map(action => {
              const iteration = action.roadmap_iteration_id ? report.iterations[action.roadmap_iteration_id] : undefined;
              return (
                <li key={action.id}>
                  <a href={`/action/${action.id}`}>{action.name}</a>
                  {action.start_year && action.end_year ? <span> ({action.start_year}–{action.end_year})</span> : null}
                  {iteration ? <span className={styles.muted}> · {t("common:roadmap_version_name", { name: iteration.roadmapName, version: iteration.version })}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
        : null}
    </section>
  );
}
