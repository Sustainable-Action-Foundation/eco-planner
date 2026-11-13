import "server-only";
import { getLikedGoals, getLikeScopes } from "@/fetchers/getGoalLikes";
import { getOrgCounts } from "@/fetchers/getOrgOverview";
import { OrgTab, orgLandingPath } from "@/functions/orgLanding";
import { orgProcess, ProcessStep, StepState } from "@/functions/orgProcess";
import type { OrgProcess } from "@/functions/orgProcess";
import serveTea from "@/lib/i18nServer";
import { LikeScope } from "@/types/enums";
import Link from "next/link";
import styles from "./orgLanding.module.css" with { type: "css" };

/**
 * The five-step process, derived from what the viewer can see of the org (see
 * `orgProcess`). The public view tells how far the org has come; the working view
 * adds the one next step to take.
 */
export default async function ProcessBar({ orgId, areaName, asVisitor, working }: {
  orgId: string,
  /** The org's area, named in the texts; null when it has none */
  areaName: string | null,
  asVisitor: boolean,
  /** The working view's variant: short steps and the next-step call to action */
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
  const stateLabels: Record<StepState, string> = {
    [StepState.Done]: t("pages:org_landing.process.state_done"),
    [StepState.InProgress]: t("pages:org_landing.process.state_in_progress"),
    [StepState.Upcoming]: t("pages:org_landing.process.state_upcoming"),
  };

  return <>
    <div className="flex gap-100 flex-wrap-wrap align-items-baseline justify-content-space-between margin-bottom-100">
      <h2 id="org-process-title" className={`margin-0 font-weight-600${working ? " font-size-125" : ""}`}>
        {working ? t("pages:org_landing.process.title_working") : t("pages:org_landing.process.title_public")}
      </h2>
      <p className="margin-0 color-gray" data-testid="org-process-status">
        {process.started
          ? t("pages:org_landing.process.status", { step: process.currentNumber })
          : t("pages:org_landing.process.status_not_started")}
      </p>
    </div>

    <ol className={styles.steps} data-testid="org-process" data-current={process.current}>
      {process.steps.map(step => (
        <li
          key={step.step}
          className={styles.step}
          data-step={step.step}
          data-state={step.state}
          aria-current={step.step === process.current ? "step" : undefined}
        >
          <span className={styles.stepLabel}>
            {String(step.number).padStart(2, "0")}
            {/* The working view only names the states that carry news; the public one spells out all of them */}
            {working && step.state === StepState.Upcoming ? null : ` · ${stateLabels[step.state]}`}
          </span>
          <strong>{names[step.step]}</strong>
          {working ? null : <span className="font-size-14px color-gray">{descriptions[step.step]}</span>}
        </li>
      ))}
    </ol>

    {working ? <NextStep orgId={orgId} areaName={areaName} process={process} likedCount={liked.length} hasArea={scopes.length > 1} /> : null}
  </>;
}

/** The one thing to do next, with one link to where it is done */
async function NextStep({ orgId, areaName, process, likedCount, hasArea }: {
  orgId: string,
  areaName: string | null,
  process: OrgProcess,
  likedCount: number,
  hasArea: boolean,
}) {
  const t = await serveTea(["pages", "common"]);

  let title: string;
  let text: string;
  let link: { href: string, label: string };
  if (process.current === ProcessStep.Indicators && likedCount === 0) {
    title = t("pages:org_landing.next.like_title");
    text = t("pages:org_landing.next.like_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Data }), label: t("pages:org_landing.next.like_link") };
  }
  else if (process.current === ProcessStep.Indicators) {
    title = t("pages:org_landing.next.compile_title");
    text = hasArea && areaName
      ? t("pages:org_landing.next.compile_text_area", { count: likedCount, area: areaName })
      : t("pages:org_landing.next.compile_text", { count: likedCount });
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Liked }), label: t("pages:org_landing.next.compile_link") };
  }
  else if (process.current === ProcessStep.Goals) {
    title = t("pages:org_landing.next.goals_title");
    text = t("pages:org_landing.next.goals_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Roadmaps }), label: t("pages:org_landing.next.open_roadmaps") };
  }
  else if (process.current === ProcessStep.Baseline) {
    title = t("pages:org_landing.next.baseline_title");
    text = t("pages:org_landing.next.baseline_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Roadmaps }), label: t("pages:org_landing.next.open_roadmaps") };
  }
  else {
    title = t("pages:org_landing.next.actions_title");
    text = t("pages:org_landing.next.actions_text");
    link = { href: orgLandingPath(orgId, { tab: OrgTab.Actions }), label: t("pages:org_landing.next.open_actions") };
  }

  return (
    <div className={styles.nextStep} data-testid="org-next-step">
      <div style={{ flex: '1 1 30ch' }}>
        <strong className="block">{title}</strong>
        <span>{text}</span>
      </div>
      <Link href={link.href} className="button seagreen color-purewhite round font-weight-500" data-testid="org-next-step-link">{link.label}</Link>
    </div>
  );
}
