import { expect, test } from "playwright/test";

import { orgProcess, ProcessStep, StepState } from "../../src/functions/orgProcess";
import type { OrgProcessInput } from "../../src/functions/orgProcess";

/*
 * The org landing's five-step process is derived from counts, never stored.
 * These pin the rules so a change to them is a deliberate one.
 */

const { Done, InProgress, Upcoming } = StepState;
const nothing: OrgProcessInput = { likedGoalCount: 0, goalCount: 0, baselineGoalCount: 0, actionLinkedGoalCount: 0 };

function states(input: Partial<OrgProcessInput>): StepState[] {
  return orgProcess({ ...nothing, ...input }).steps.map(step => step.state);
}

test("five steps, numbered in order", () => {
  const { steps } = orgProcess(nothing);
  expect(steps.map(step => step.step)).toEqual([ProcessStep.Indicators, ProcessStep.Goals, ProcessStep.Baseline, ProcessStep.Actions, ProcessStep.Decision]);
  expect(steps.map(step => step.number)).toEqual([1, 2, 3, 4, 5]);
});

test("nothing yet: every step upcoming, the first one current but not started", () => {
  const process = orgProcess(nothing);
  expect(process.steps.map(step => step.state)).toEqual([Upcoming, Upcoming, Upcoming, Upcoming, Upcoming]);
  expect(process.current).toBe(ProcessStep.Indicators);
  expect(process.currentNumber).toBe(1);
  expect(process.started).toBe(false);
});

test("likes put the indicators step in progress", () => {
  const process = orgProcess({ ...nothing, likedGoalCount: 13 });
  expect(process.steps.map(step => step.state)).toEqual([InProgress, Upcoming, Upcoming, Upcoming, Upcoming]);
  expect(process.current).toBe(ProcessStep.Indicators);
  expect(process.started).toBe(true);
});

test("a roadmap with goals finishes the indicators step, with or without likes", () => {
  expect(states({ goalCount: 4 })).toEqual([Done, InProgress, Upcoming, Upcoming, Upcoming]);
  expect(states({ likedGoalCount: 2, goalCount: 4 })).toEqual([Done, InProgress, Upcoming, Upcoming, Upcoming]);
  expect(orgProcess({ ...nothing, goalCount: 4 }).current).toBe(ProcessStep.Goals);
});

test("baselines move the work on to the baseline step", () => {
  const process = orgProcess({ ...nothing, goalCount: 4, baselineGoalCount: 1 });
  expect(process.steps.map(step => step.state)).toEqual([Done, Done, InProgress, Upcoming, Upcoming]);
  expect(process.current).toBe(ProcessStep.Baseline);
});

test("baselines and linked actions: the actions step is in progress and stays there", () => {
  const process = orgProcess({ likedGoalCount: 9, goalCount: 4, baselineGoalCount: 4, actionLinkedGoalCount: 4 });
  expect(process.steps.map(step => step.state)).toEqual([Done, Done, Done, InProgress, Upcoming]);
  expect(process.current).toBe(ProcessStep.Actions);
  expect(process.currentNumber).toBe(4);
});

test("linked actions without baselines: the skipped baseline step is the current one", () => {
  const process = orgProcess({ ...nothing, goalCount: 4, actionLinkedGoalCount: 2 });
  expect(process.steps.map(step => step.state)).toEqual([Done, Done, Upcoming, InProgress, Upcoming]);
  expect(process.current).toBe(ProcessStep.Baseline);
});

test("the decision step is never derived", () => {
  for (const input of [nothing, { likedGoalCount: 99, goalCount: 99, baselineGoalCount: 99, actionLinkedGoalCount: 99 }]) {
    const process = orgProcess(input);
    expect(process.steps.at(-1)).toEqual({ step: ProcessStep.Decision, number: 5, state: Upcoming });
    expect(process.current).not.toBe(ProcessStep.Decision);
  }
});
