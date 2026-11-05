import { expect, test } from "playwright/test";

import { yAxisBounds } from "../../src/components/graph/functions/yAxisBounds";

/*
 * Which end of a goal graph's y axis is pinned at zero: ApexCharts scales to
 * the data otherwise, which draws a flat series on a ±1 band around its value.
 */
test.describe("Y axis bounds", () => {
  test("a varying series is left to the chart's own scaling", () => {
    expect(yAxisBounds([100, 200, 400])).toEqual({});
    expect(yAxisBounds([-3, -2, -1])).toEqual({});
    expect(yAxisBounds([-1, 0, 1])).toEqual({});
  });

  test("a flat series is pinned at zero on the side it lies", () => {
    expect(yAxisBounds([200_000, 200_000, 200_000])).toEqual({ min: 0 });
    expect(yAxisBounds([-150, -150])).toEqual({ max: 0 });
    expect(yAxisBounds([1.5])).toEqual({ min: 0 });
  });

  test("floating point noise still counts as flat", () => {
    // The annual change of a linear series in decimals, as subtraction yields it
    const linear = Array.from({ length: 31 }, (_, i) => 0.03 * i);
    const changes = linear.slice(1).map((value, i) => value - linear[i]);
    expect(new Set(changes).size).toBeGreaterThan(1);
    expect(yAxisBounds(changes)).toEqual({ min: 0 });
  });

  test("a flat zero series and an empty one are left alone", () => {
    expect(yAxisBounds([0, 0, 0])).toEqual({});
    expect(yAxisBounds([])).toEqual({});
    expect(yAxisBounds([NaN, Infinity])).toEqual({});
  });

  test("anchoring at zero pins one-sided values whether flat or not", () => {
    expect(yAxisBounds([100, 200, 400], { anchorZero: true })).toEqual({ min: 0 });
    expect(yAxisBounds([-3, -2, -1], { anchorZero: true })).toEqual({ max: 0 });
    expect(yAxisBounds([-1, 0, 1], { anchorZero: true })).toEqual({});
    expect(yAxisBounds([0, 5], { anchorZero: true })).toEqual({});
  });
});
