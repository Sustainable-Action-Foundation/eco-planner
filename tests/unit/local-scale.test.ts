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

  test("falls back to the goal's nearest year", () => {
    const early: DateValues = { "2019-01-01T00:00:00.000Z": 3 };
    expect(localAnchor(early, goal)).toEqual({ year: 2019, localValue: 3, goalValue: 100 });
  });

  test("scales the whole goal by the anchor ratio", () => {
    expect(scaleToLocal(goal, local)).toEqual({
      "2022-01-01T00:00:00.000Z": 2.5,
      "2025-01-01T00:00:00.000Z": 5,
      "2030-01-01T00:00:00.000Z": 10,
    });
  });

  test("has nothing to scale from an empty or zero goal", () => {
    expect(localAnchor({}, goal)).toBeNull();
    expect(scaleToLocal({}, local)).toBeNull();
    expect(scaleToLocal({ "2025-01-01T00:00:00.000Z": 0 }, local)).toBeNull();
  });
});
