import "server-only";
import { getLikedGoals, getLikeScopes } from "@/fetchers/getGoalLikes";
import { getOrgCounts } from "@/fetchers/getOrgOverview";
import { OrgTab, orgLandingPath } from "@/functions/orgLanding";
import { orgProcess, ProcessStep } from "@/functions/orgProcess";
import type { OrgProcess, StepMeasure } from "@/functions/orgProcess";
import serveTea from "@/lib/i18nServer";
import { LikeScope } from "@/types/enums";
import type { TFunction } from "i18next";
import Link from "next/link";
import styles from "./orgLanding.module.css" with { type: "css" };

/** The line under a step that says how much of it there is, in the numbers its meter shows */
function measureText(t: TFunction, measure: StepMeasure, likedCount: number): string {
  const count = measure.count ?? 0;
  if (measure.step === ProcessStep.Indicators) {
    return count === 0
      ? t("pages:org_landing.process.measure.indicators_none")
      : t("pages:org_landing.process.measure.indicators", { count });
  }
  if (measure.step === ProcessStep.Goals) {
    // Without likes there is nothing to hold the goals against
    if (measure.total === null) {
      return count === 0
        ? t("pages:org_landing.process.measure.goals_none")
        : t("pages:org_landing.process.measure.goals", { count });
    }
    return t("pages:org_landing.process.measure.goals_against_liked", {
      goals: t("pages:org_landing.process.measure.goals", { count }),
      liked: t("pages:org_landing.process.measure.indicators", { count: likedCount }),
    });
  }
  if (measure.step === ProcessStep.Baseline) {
    return measure.total === null
      ? t("pages:org_landing.process.measure.no_goals")
      : t("pages:org_landing.process.measure.baseline", { with: count, count: measure.total });
  }
  if (measure.step === ProcessStep.Actions) {
    return measure.total === null
      ? t("pages:org_landing.process.measure.no_goals")
      : t("pages:org_landing.process.measure.actions", { with: count, count: measure.total });
  }
  return t("pages:org_landing.process.measure.decision");
}

/**
 * The five-step process over what the viewer can see of the org (see `orgProcess`):
 * a measure per step, and the step in focus now, with its period when the org's
 * managers have given one. The work recurs every year, so nothing here reads as
 * finished. The working view adds where to carry on with the step in focus.
 */
export default async function ProcessBar({ orgId, areaName, focusStep, focusPeriod, asVisitor, working }: {
  orgId: string,
  /** The org's area, named in the texts; null when it has none */
  areaName: string | null,
  /** The step the managers have put the focus on; null derives it from the measures */
  focusStep: ProcessStep | null,
  /** When that is, in the managers' words */
  focusPeriod: string | null,
  asVisitor: boolean,
  /** The working view's variant: short steps and the call to carry on */
  working: boolean,
}) {
  const scopes = await getLikeScopes(orgId);
  // Likes anywhere in the org's area count (the org's own are among them)
  const scope = scopes.find(option => option.scope === LikeScope.Area) ?? scopes[0];
  const [t, counts, liked] = await Promise.all([
    serveTea(["pages", "common"]),
    getOrgCounts(orgId, { asVisitor }),
    getLikedGoals(orgId, scope.scope, { asVisitor }),
  ]);
  const process = orgProcess({
    likedGoalCount: liked.length,
    goalCount: counts.goals,
    baselineGoalCount: counts.goalsWithBaseline,
    actionLinkedGoalCount: counts.goalsWithActions,
    focusStep,
  });

  const names: Record<ProcessStep, string> = {
    [ProcessStep.Indicators]: t("pages:org_landing.process.indicators"),
    [ProcessStep.Goals]: t("pages:org_landing.process.goals"),
    [ProcessStep.Baseline]: t("pages:org_landing.process.baseline"),
    [ProcessStep.Actions]: t("pages:org_landing.process.actions"),
    [ProcessStep.Decision]: t("pages:org_landing.process.decision"),
  };
  const descriptions: Record<ProcessStep, string> = {
    [ProcessStep.Indicators]: t("pages:org_landing.process.indicators_description"),
    [ProcessStep.Goals]: areaName
      ? t("pages:org_landing.process.goals_description_area", { area: areaName })
      : t("pages:org_landing.process.goals_description"),
    [ProcessStep.Baseline]: t("pages:org_landing.process.baseline_description"),
    [ProcessStep.Actions]: t("pages:org_landing.process.actions_description"),
    [ProcessStep.Decision]: t("pages:org_landing.process.decision_description"),
  };

  return <>
    <div className="flex gap-100 flex-wrap-wrap align-items-baseline justify-content-space-between margin-bottom-100">
      <h2 id="org-process-title" className={`margin-0 font-weight-600${working ? " font-size-125" : ""}`}>
        {working ? t("pages:org_landing.process.title_working") : t("pages:org_landing.process.title_public")}
      </h2>
      <p className="margin-0 color-gray" data-testid="org-process-status">
        {focusPeriod
          ? t("pages:org_landing.process.focus_status_period", { step: names[process.focus], period: focusPeriod })
          : t("pages:org_landing.process.focus_status", { step: names[process.focus] })}
      </p>
    </div>

    <ol className={styles.steps} data-testid="org-process" data-focus={process.focus} data-focus-source={process.focusSource}>
      {process.steps.map(step => {
        const inFocus = step.step === process.focus;
        const text = measureText(t, step, liked.length);
        return (
          <li
            key={step.step}
            className={styles.step}
            data-step={step.step}
            data-focus={inFocus ? "true" : undefined}
            aria-current={inFocus ? "step" : undefined}
          >
            <span className={styles.stepLabel}>
              {String(step.number).padStart(2, "0")}
              {inFocus ? <> · <span data-testid="org-process-focus">{t("pages:org_landing.process.focus_badge")}</span></> : null}
            </span>
            <strong>{names[step.step]}</strong>
            {working ? null : <span className="font-size-14px color-gray">{descriptions[step.step]}</span>}
            <span className={styles.stepMeasure}>
              {/* A meter only where there is something to measure against */}
              {step.share !== null && step.count !== null && step.total !== null
                ? <meter className={styles.meter} min={0} max={step.total} value={Math.min(step.count, step.total)} aria-label={text} data-testid="org-step-meter" />
                : null}
              <span className="font-size-14px" data-testid="org-step-measure">{text}</span>
            </span>
          </li>
        );
      })}
    </ol>

    {working ? <NextStep orgId={orgId} areaName={areaName} process={process} likedCount={liked.length} goalCount={counts.goals} hasArea={scopes.length > 1} /> : null}
  </>;
}

/** Where to carry on with the step in focus, with one link to where that is done */
async function NextStep({ orgId, areaName, process, likedCount, goalCount, hasArea }: {
  orgId: string,
  areaName: string | null,
  process: OrgProcess,
  likedCount: number,
  goalCount: number,
  hasArea: boolean,
}) {
  const t = await serveTea(["pages", "common"]);

  let title: string;
  let text: string;
  let link: { href: string, label: string };
  if (process.focus === ProcessStep.Indicators && likedCount === 0) {
    title = t("pages:org_landing.next.like_title");
    text = t("pages:org_landing.next.like_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Data }), label: t("pages:org_landing.next.like_link") };
  }
  // Likes are turned into goals from the compilation, whichever of the two steps is in focus
  else if (process.focus === ProcessStep.Indicators || (process.focus === ProcessStep.Goals && goalCount === 0 && likedCount > 0)) {
    title = t("pages:org_landing.next.compile_title");
    text = hasArea && areaName
      ? t("pages:org_landing.next.compile_text_area", { count: likedCount, area: areaName })
      : t("pages:org_landing.next.compile_text", { count: likedCount });
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Liked }), label: t("pages:org_landing.next.compile_link") };
  }
  else if (process.focus === ProcessStep.Goals) {
    title = t("pages:org_landing.next.goals_title");
    text = t("pages:org_landing.next.goals_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Roadmaps }), label: t("pages:org_landing.next.open_roadmaps") };
  }
  else if (process.focus === ProcessStep.Baseline) {
    title = t("pages:org_landing.next.baseline_title");
    text = t("pages:org_landing.next.baseline_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Roadmaps }), label: t("pages:org_landing.next.open_roadmaps") };
  }
  else if (process.focus === ProcessStep.Actions) {
    title = t("pages:org_landing.next.actions_title");
    text = t("pages:org_landing.next.actions_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Actions }), label: t("pages:org_landing.next.open_actions") };
  }
  else {
    title = t("pages:org_landing.next.decision_title");
    text = t("pages:org_landing.next.decision_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Actions }), label: t("pages:org_landing.next.open_actions") };
  }

  return (
    <div className={styles.nextStep} data-testid="org-next-step" data-step={process.focus}>
      <div style={{ flex: '1 1 30ch' }}>
        <strong className="block">{title}</strong>
        <span>{text}</span>
      </div>
      <Link href={link.href} className="button seagreen color-purewhite round font-weight-500" data-testid="org-next-step-link">{link.label}</Link>
    </div>
  );
}
