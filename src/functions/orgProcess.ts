// No `server-only` marker: pure, unit tested.

/** The five steps an org's climate work goes through, in order */
export const ProcessStep = {
  Indicators: "INDICATORS",
  Goals: "GOALS",
  Baseline: "BASELINE",
  Actions: "ACTIONS",
  Decision: "DECISION",
} as const;
export type ProcessStep = (typeof ProcessStep)[keyof typeof ProcessStep];

export const StepState = {
  Done: "DONE",
  InProgress: "IN_PROGRESS",
  Upcoming: "UPCOMING",
} as const;
export type StepState = (typeof StepState)[keyof typeof StepState];

/** What the process is derived from; every number counts only what the viewer may see */
export type OrgProcessInput = {
  /** Goals liked by the org's members, or by anyone in its area */
  likedGoalCount: number,
  /** Goals in the org's visible roadmaps */
  goalCount: number,
  /** Of those, the ones with a baseline */
  baselineGoalCount: number,
  /** Of those, the ones with an action linked to them */
  actionLinkedGoalCount: number,
};

export type OrgProcess = {
  steps: { step: ProcessStep, number: number, state: StepState }[],
  /** The step the org is on: the first one that isn't done. Never the last one's successor, since the last is never done */
  current: ProcessStep,
  currentNumber: number,
  /** Whether anything at all has happened; false means the current step has yet to begin */
  started: boolean,
};

/**
 * Where an org is in the five-step process. Derived from its data, nothing is stored:
 *
 * 1. Indicators: in progress once there are likes, done once a roadmap has goals.
 * 2. Goals: begun once a roadmap has goals, done once the work has moved on (baselines or linked actions).
 * 3. Baseline: begun once goals have baselines, done once goals also have linked actions.
 * 4. Actions: in progress once goals have linked actions. Never done on its own.
 * 5. Decision: never derived; always upcoming.
 *
 * A step whose own condition doesn't hold stays upcoming even when a later one has begun
 * (actions linked before any baseline exists), so the gap shows and becomes the current step.
 */
export function orgProcess(input: OrgProcessInput): OrgProcess {
  const hasLikes = input.likedGoalCount > 0;
  const hasGoals = input.goalCount > 0;
  const hasBaselines = input.baselineGoalCount > 0;
  const hasLinkedActions = input.actionLinkedGoalCount > 0;

  const state = (begun: boolean, done: boolean): StepState => done ? StepState.Done : begun ? StepState.InProgress : StepState.Upcoming;

  const states: Record<ProcessStep, StepState> = {
    [ProcessStep.Indicators]: state(hasLikes, hasGoals),
    [ProcessStep.Goals]: state(hasGoals, hasGoals && (hasBaselines || hasLinkedActions)),
    [ProcessStep.Baseline]: state(hasBaselines, hasBaselines && hasLinkedActions),
    [ProcessStep.Actions]: state(hasLinkedActions, false),
    [ProcessStep.Decision]: StepState.Upcoming,
  };

  const steps = Object.values(ProcessStep).map((step, index) => ({ step, number: index + 1, state: states[step] }));
  // The last step is never done, so there always is one
  const current = steps.find(step => step.state !== StepState.Done) ?? steps[steps.length - 1];

  return {
    steps,
    current: current.step,
    currentNumber: current.number,
    started: steps.some(step => step.state !== StepState.Upcoming),
  };
}
