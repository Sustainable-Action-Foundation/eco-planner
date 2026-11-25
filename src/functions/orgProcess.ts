// No `server-only` marker: pure, shared by the org API and the management form, and unit tested.

/** The five steps an org's climate work goes through, in order. The work recurs every year, so no step is ever finished */
export const ProcessStep = {
  Indicators: "INDICATORS",
  Goals: "GOALS",
  Baseline: "BASELINE",
  Actions: "ACTIONS",
  Decision: "DECISION",
} as const;
export type ProcessStep = (typeof ProcessStep)[keyof typeof ProcessStep];

/** Where the focus comes from: set by the org's managers, or derived from its data */
export const FocusSource = {
  Manual: "MANUAL",
  Derived: "DERIVED",
} as const;
export type FocusSource = (typeof FocusSource)[keyof typeof FocusSource];

/** Longest period text accepted, in characters (the column is VARCHAR(60)) */
export const focusPeriodMaxLength = 60;

/** What the process is derived from; every number counts only what the viewer may see */
export type OrgProcessInput = {
  /** Goals liked by the org's members, or by anyone in its area: the indicators picked out */
  likedGoalCount: number,
  /** Listed goals in the org's visible roadmaps */
  goalCount: number,
  /** Of those, the ones with a baseline */
  baselineGoalCount: number,
  /** Of those, the ones with an action linked to them */
  actionLinkedGoalCount: number,
  /** The step the org's managers have set as the focus; null to derive it */
  focusStep?: ProcessStep | null,
};

/** How far one step has come, in the numbers it is shown with */
export type StepMeasure = {
  step: ProcessStep,
  /** 1 to 5 */
  number: number,
  /** What there is of the step's own thing; null for a step that isn't measured */
  count: number | null,
  /** What `count` is held against; null when there is nothing to hold it against */
  total: number | null,
  /** `count / total`, at most 1: what a meter shows. Null without a total, where a meter would be pretending */
  share: number | null,
};

export type OrgProcess = {
  steps: StepMeasure[],
  /** The step the org works on now */
  focus: ProcessStep,
  focusNumber: number,
  focusSource: FocusSource,
};

function measure(count: number, total: number | null): Pick<StepMeasure, "count" | "total" | "share"> {
  return { count, total, share: total !== null && total > 0 ? Math.min(1, count / total) : null };
}

/**
 * The step to focus on when the managers haven't set one, from the measures:
 *
 * 1. No goals: Indicators while nothing is liked either, Goals once there are likes to turn into goals.
 * 2. Otherwise the step with the lowest share among those that have one (Goals when there
 *    are likes to hold the goals against, Baseline, Actions); the earliest on a tie.
 * 3. All of them full: Actions, the last measured step, since no earlier one has a gap.
 *
 * Never Decision, which isn't measured; only the managers can put the focus there.
 */
export function derivedFocus(steps: StepMeasure[]): ProcessStep {
  const count = (step: ProcessStep) => steps.find(candidate => candidate.step === step)?.count ?? 0;
  if (count(ProcessStep.Goals) === 0) {
    return count(ProcessStep.Indicators) === 0 ? ProcessStep.Indicators : ProcessStep.Goals;
  }

  let lowest: { step: ProcessStep, share: number } | null = null;
  for (const { step, share } of steps) {
    if (share !== null && (lowest === null || share < lowest.share)) lowest = { step, share };
  }
  return lowest === null || lowest.share === 1 ? ProcessStep.Actions : lowest.step;
}

/**
 * The org's five-step process: a measure per step, and the one step in focus.
 * Nothing here says a step is finished; the measures only tell how much there is.
 *
 * 1. Indicators: how many are liked. A count only; there is no number of indicators to like.
 * 2. Goals: the org's goals against the liked indicators. The goals aren't a subset of the
 *    likes, so this is a ratio, capped at full when there are more goals than likes;
 *    without likes there is nothing to hold the goals against and only the count is given.
 * 3. Baseline: the goals with a baseline, out of all goals.
 * 4. Actions: the goals with a linked action, out of all goals.
 * 5. Decision: not measured.
 *
 * The focus is the managers' choice when they have made one, else `derivedFocus`.
 */
export function orgProcess(input: OrgProcessInput): OrgProcess {
  const goals = input.goalCount > 0 ? input.goalCount : null;
  const measures: Record<ProcessStep, Pick<StepMeasure, "count" | "total" | "share">> = {
    [ProcessStep.Indicators]: measure(input.likedGoalCount, null),
    [ProcessStep.Goals]: measure(input.goalCount, input.likedGoalCount > 0 ? input.likedGoalCount : null),
    [ProcessStep.Baseline]: measure(input.baselineGoalCount, goals),
    [ProcessStep.Actions]: measure(input.actionLinkedGoalCount, goals),
    [ProcessStep.Decision]: { count: null, total: null, share: null },
  };

  const steps = Object.values(ProcessStep).map((step, index) => ({ step, number: index + 1, ...measures[step] }));
  const focus = input.focusStep ?? derivedFocus(steps);

  return {
    steps,
    focus,
    focusNumber: steps.findIndex(step => step.step === focus) + 1,
    focusSource: input.focusStep ? FocusSource.Manual : FocusSource.Derived,
  };
}
