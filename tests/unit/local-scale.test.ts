import { expect, test } from "playwright/test";
import { localAnchor, scaleToLocal } from "../../src/functions/localScale";
import type { DateValues } from "../../src/types";

const goal: DateValues = {
  "2022-01-01T00:00:00.000Z": 100,
  "2025-01-01T00:00:00.000Z": 200,
  "2030-01-01T00:00:00.000Z": 400,
};
const local: DateValues = {
  "2015-01-01T00:00:00.000Z": 1,
  "2024-01-01T00:00:00.000Z": 4,
  "2025-01-01T00:00:00.000Z": 5,
};

test.describe("Scaling a goal to a local series", () => {
  test("anchors at the local series' latest year", () => {
    expect(localAnchor(local, goal)).toEqual({ year: 2025, localValue: 5, goalValue: 200 });
  });

  test("the latest local year is found regardless of key order", () => {
    const shuffled: DateValues = { "2025-01-01T00:00:00.000Z": 5, "2015-01-01T00:00:00.000Z": 1, "2024-01-01T00:00:00.000Z": 4 };
    expect(localAnchor(shuffled, goal)).toEqual({ year: 2025, localValue: 5, goalValue: 200 });
  });

  test("falls back to the goal's nearest year", () => {
    const early: DateValues = { "2019-01-01T00:00:00.000Z": 3 };
    expect(localAnchor(early, goal)).toEqual({ year: 2019, localValue: 3, goalValue: 100 });
    const late: DateValues = { "2040-01-01T00:00:00.000Z": 7 };
    expect(localAnchor(late, goal)).toEqual({ year: 2040, localValue: 7, goalValue: 400 });
    const between: DateValues = { "2028-01-01T00:00:00.000Z": 6 };
    expect(localAnchor(between, goal)).toEqual({ year: 2028, localValue: 6, goalValue: 400 });
  });

  test("an equidistant tie goes to the goal year listed first (the earlier one in a chronological goal)", () => {
    const tied: DateValues = { "2022-01-01T00:00:00.000Z": 100, "2026-01-01T00:00:00.000Z": 300 };
    const midway: DateValues = { "2024-01-01T00:00:00.000Z": 4 };
    expect(localAnchor(midway, tied)).toEqual({ year: 2024, localValue: 4, goalValue: 100 });
  });

  test("scales the whole goal by the anchor ratio", () => {
    expect(scaleToLocal(goal, local)).toEqual({
      "2022-01-01T00:00:00.000Z": 2.5,
      "2025-01-01T00:00:00.000Z": 5,
      "2030-01-01T00:00:00.000Z": 10,
    });
  });

  test("the scaled goal passes through the local value at the anchor year", () => {
    const scaled = scaleToLocal(goal, local);
    expect(scaled?.["2025-01-01T00:00:00.000Z"]).toBe(local["2025-01-01T00:00:00.000Z"]);
  });

  test("negative values scale by the same (signed) ratio", () => {
    const negativeGoal: DateValues = { "2022-01-01T00:00:00.000Z": -100, "2025-01-01T00:00:00.000Z": -200, "2030-01-01T00:00:00.000Z": 50 };
    // local 5 / goal -200 = -0.025
    expect(scaleToLocal(negativeGoal, local)).toEqual({
      "2022-01-01T00:00:00.000Z": 2.5,
      "2025-01-01T00:00:00.000Z": 5,
      "2030-01-01T00:00:00.000Z": -1.25,
    });
    const negativeLocal: DateValues = { "2025-01-01T00:00:00.000Z": -5 };
    expect(scaleToLocal(goal, negativeLocal)).toEqual({
      "2022-01-01T00:00:00.000Z": -2.5,
      "2025-01-01T00:00:00.000Z": -5,
      "2030-01-01T00:00:00.000Z": -10,
    });
  });

  test("a zero local value flattens the goal to zero", () => {
    expect(scaleToLocal(goal, { "2025-01-01T00:00:00.000Z": 0 })).toEqual({
      "2022-01-01T00:00:00.000Z": 0,
      "2025-01-01T00:00:00.000Z": 0,
      "2030-01-01T00:00:00.000Z": 0,
    });
  });

  test("has nothing to scale from an empty or zero goal", () => {
    expect(localAnchor({}, goal)).toBeNull();
    expect(localAnchor(local, {})).toBeNull();
    expect(scaleToLocal({}, local)).toBeNull();
    expect(scaleToLocal(goal, {})).toBeNull();
    // The anchor exists but the goal is zero there: no ratio
    expect(localAnchor(local, { "2025-01-01T00:00:00.000Z": 0 })).toEqual({ year: 2025, localValue: 5, goalValue: 0 });
    expect(scaleToLocal({ "2025-01-01T00:00:00.000Z": 0 }, local)).toBeNull();
  });
});
