import { expect, test } from "playwright/test";

import { derivedFocus, FocusSource, orgProcess, ProcessStep } from "../../src/functions/orgProcess";
import type { OrgProcessInput } from "../../src/functions/orgProcess";

/*
 * The org landing's five-step process: a measure per step from counts, and the
 * step in focus, which the managers set or which is derived. The work recurs
 * yearly, so no step is ever finished. These pin the rules so a change to them
 * is a deliberate one.
 */

const nothing: OrgProcessInput = { likedGoalCount: 0, goalCount: 0, baselineGoalCount: 0, actionLinkedGoalCount: 0 };

function measures(input: Partial<OrgProcessInput>) {
  return Object.fromEntries(orgProcess({ ...nothing, ...input }).steps.map(step => [step.step, { count: step.count, total: step.total, share: step.share }]));
}

function focus(input: Partial<OrgProcessInput>): ProcessStep {
  return orgProcess({ ...nothing, ...input }).focus;
}

test("five steps, numbered in order, none with a state", () => {
  const { steps } = orgProcess(nothing);
  expect(steps.map(step => step.step)).toEqual([ProcessStep.Indicators, ProcessStep.Goals, ProcessStep.Baseline, ProcessStep.Actions, ProcessStep.Decision]);
  expect(steps.map(step => step.number)).toEqual([1, 2, 3, 4, 5]);
  for (const step of steps) expect(Object.keys(step).sort()).toEqual(["count", "number", "share", "step", "total"]);
});

test.describe("measures", () => {
  test("nothing yet: zero counts and no meter anywhere", () => {
    expect(measures({})).toEqual({
      [ProcessStep.Indicators]: { count: 0, total: null, share: null },
      [ProcessStep.Goals]: { count: 0, total: null, share: null },
      [ProcessStep.Baseline]: { count: 0, total: null, share: null },
      [ProcessStep.Actions]: { count: 0, total: null, share: null },
      [ProcessStep.Decision]: { count: null, total: null, share: null },
    });
  });

  test("indicators are a count only, however many are liked", () => {
    expect(measures({ likedGoalCount: 13 })[ProcessStep.Indicators]).toEqual({ count: 13, total: null, share: null });
  });

  test("goals are held against the liked indicators", () => {
    expect(measures({ likedGoalCount: 12, goalCount: 3 })[ProcessStep.Goals]).toEqual({ count: 3, total: 12, share: 0.25 });
    expect(measures({ likedGoalCount: 12 })[ProcessStep.Goals]).toEqual({ count: 0, total: 12, share: 0 });
  });

  test("more goals than likes: the share stops at full, the numbers stay true", () => {
    expect(measures({ likedGoalCount: 4, goalCount: 9 })[ProcessStep.Goals]).toEqual({ count: 9, total: 4, share: 1 });
  });

  test("goals without likes: a count and no share", () => {
    expect(measures({ goalCount: 9 })[ProcessStep.Goals]).toEqual({ count: 9, total: null, share: null });
  });

  test("baselines and linked actions are shares of the goals", () => {
    const result = measures({ goalCount: 12, baselineGoalCount: 8, actionLinkedGoalCount: 3 });
    expect(result[ProcessStep.Baseline]).toEqual({ count: 8, total: 12, share: 8 / 12 });
    expect(result[ProcessStep.Actions]).toEqual({ count: 3, total: 12, share: 0.25 });
  });

  test("the decision step is never measured", () => {
    for (const input of [nothing, { likedGoalCount: 99, goalCount: 99, baselineGoalCount: 99, actionLinkedGoalCount: 99 }]) {
      expect(orgProcess(input).steps.at(-1)).toEqual({ step: ProcessStep.Decision, number: 5, count: null, total: null, share: null });
    }
  });
});

test.describe("derived focus", () => {
  test("nothing yet: indicators", () => {
    const process = orgProcess(nothing);
    expect(process.focus).toBe(ProcessStep.Indicators);
    expect(process.focusNumber).toBe(1);
    expect(process.focusSource).toBe(FocusSource.Derived);
  });

  test("likes but no goals: goals", () => {
    expect(focus({ likedGoalCount: 13 })).toBe(ProcessStep.Goals);
  });

  test("goals: the step with the lowest share", () => {
    // Goals 3/12, baseline 2/3, actions 1/3
    expect(focus({ likedGoalCount: 12, goalCount: 3, baselineGoalCount: 2, actionLinkedGoalCount: 1 })).toBe(ProcessStep.Goals);
    // Goals 10/12, baseline 2/10, actions 5/10
    expect(focus({ likedGoalCount: 12, goalCount: 10, baselineGoalCount: 2, actionLinkedGoalCount: 5 })).toBe(ProcessStep.Baseline);
    // Goals 10/12, baseline 9/10, actions 5/10
    expect(focus({ likedGoalCount: 12, goalCount: 10, baselineGoalCount: 9, actionLinkedGoalCount: 5 })).toBe(ProcessStep.Actions);
  });

  test("a tie goes to the earliest step", () => {
    expect(focus({ likedGoalCount: 8, goalCount: 4, baselineGoalCount: 2, actionLinkedGoalCount: 2 })).toBe(ProcessStep.Goals);
    expect(focus({ goalCount: 4 })).toBe(ProcessStep.Baseline);
    // Linked actions before any baseline: the skipped step
    expect(focus({ goalCount: 4, actionLinkedGoalCount: 2 })).toBe(ProcessStep.Baseline);
  });

  test("goals without likes are not sent back to the indicators", () => {
    expect(focus({ goalCount: 4, baselineGoalCount: 4, actionLinkedGoalCount: 1 })).toBe(ProcessStep.Actions);
  });

  test("everything full: actions, never the decision", () => {
    const full = { likedGoalCount: 4, goalCount: 9, baselineGoalCount: 9, actionLinkedGoalCount: 9 };
    expect(focus(full)).toBe(ProcessStep.Actions);
    expect(derivedFocus(orgProcess(full).steps)).toBe(ProcessStep.Actions);
  });
});

test.describe("focus set by the managers", () => {
  test("wins over the derived one, whatever the data says", () => {
    for (const step of Object.values(ProcessStep)) {
      const process = orgProcess({ ...nothing, focusStep: step });
      expect(process.focus).toBe(step);
      expect(process.focusSource).toBe(FocusSource.Manual);
    }
    const process = orgProcess({ likedGoalCount: 12, goalCount: 3, baselineGoalCount: 0, actionLinkedGoalCount: 0, focusStep: ProcessStep.Decision });
    expect(process.focusNumber).toBe(5);
    // The measures are the same either way
    expect(process.steps).toEqual(orgProcess({ likedGoalCount: 12, goalCount: 3, baselineGoalCount: 0, actionLinkedGoalCount: 0 }).steps);
  });

  test("null and undefined derive", () => {
    expect(orgProcess({ ...nothing, focusStep: null }).focusSource).toBe(FocusSource.Derived);
    expect(orgProcess({ ...nothing, focusStep: undefined }).focusSource).toBe(FocusSource.Derived);
  });
});
