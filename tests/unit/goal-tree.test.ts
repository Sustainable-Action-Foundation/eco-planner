import { expect, test } from "playwright/test";
import type { TFunction } from "i18next";

import findSiblings, { siblingIndicatorPrefixes } from "../../src/functions/findSiblings";
import goalsToTree from "../../src/functions/goalsToTree";
import { GoalListing } from "../../src/lib/prisma/generated";
import type { GoalTree, GoalTreeEntry } from "../../src/types";

/*
 * Both functions walk the backslash-separated indicator parameter. The tree
 * drops the LEAP "Key"/"Demand" prefix and keys leaves by display name plus
 * unit; siblings share every segment but the last, the level and the unit.
 */

const t = ((key: string) => key) as unknown as TFunction;
const ZWNJ = "‌";

function entry(id: string, indicator: string, options: { name?: string | null, unit?: string | null, noSeries?: boolean } = {}): GoalTreeEntry {
  return {
    id,
    name: options.name ?? null,
    indicator_parameter: indicator,
    data_series: options.noSeries ? null : { id: `${id}-series`, unit: options.unit === undefined ? "st" : options.unit },
  } as unknown as GoalTreeEntry;
}

test.describe("goalsToTree", () => {
  test("nests by every segment but the last and keys leaves by display name and unit", () => {
    const count = entry("count", "Key\\Transport\\Cars\\Count");
    const share = entry("share", "Key\\Transport\\Cars\\Share", { unit: "procent" });
    const tree = goalsToTree([count, share], t);
    expect(Object.keys(tree)).toEqual(["Transport"]);
    const cars = (tree.Transport as GoalTree).Cars as GoalTree;
    expect(Object.keys(cars).sort()).toEqual([`Count (${ZWNJ}st)`, `Share (${ZWNJ}procent)`]);
    expect(cars[`Count (${ZWNJ}st)`]).toBe(count);
  });

  test("a named goal is keyed by its name, an unnamed one by its leaf", () => {
    const named = entry("named", "Key\\Transport\\Cars\\Count", { name: "Elbilar" });
    const tree = goalsToTree([named], t);
    const cars = (tree.Transport as GoalTree).Cars as GoalTree;
    expect(Object.keys(cars)).toEqual([`Elbilar (${ZWNJ}st)`]);
  });

  test("drops the Key and Demand prefixes case-insensitively, and keeps other prefixes", () => {
    const tree = goalsToTree([
      entry("a", "Key\\Energy\\Total"),
      entry("b", "demand\\Energy\\Heat"),
      entry("c", "Supply\\Energy\\Wind"),
    ], t);
    expect(Object.keys(tree).sort()).toEqual(["Energy", "Supply"]);
    expect(Object.keys(tree.Energy as GoalTree).sort()).toEqual([`Heat (${ZWNJ}st)`, `Total (${ZWNJ}st)`]);
    expect(Object.keys((tree.Supply as GoalTree).Energy as GoalTree)).toEqual([`Wind (${ZWNJ}st)`]);
  });

  test("a single-segment parameter gets a branch of its own name", () => {
    const lonely = entry("l", "Lonely");
    const keyed = entry("k", "Key\\Alone");
    const tree = goalsToTree([lonely, keyed], t);
    expect(tree.Lonely).toEqual({ [`Lonely (${ZWNJ}st)`]: lonely });
    expect(tree.Alone).toEqual({ [`Alone (${ZWNJ}st)`]: keyed });
  });

  test("unitless and missing-unit series are labelled through t()", () => {
    const tree = goalsToTree([
      entry("u", "Key\\A\\Unitless", { unit: null }),
      entry("m", "Key\\A\\Missing", { noSeries: true }),
      entry("b", "Key\\A\\Blank", { unit: "" }),
    ], t);
    expect(Object.keys(tree.A as GoalTree).sort()).toEqual([
      `Blank (${ZWNJ})`,
      `Missing (${ZWNJ}common:tsx.unit_missing)`,
      `Unitless (${ZWNJ}common:tsx.unitless)`,
    ]);
  });

  test("null entries are skipped and leaves come before branches", () => {
    const leaf = entry("leaf", "Key\\Transport\\Leaf");
    const deep = entry("deep", "Key\\Transport\\Cars\\Count");
    const tree = goalsToTree([null, deep, null, leaf], t);
    expect(Object.keys(tree.Transport as GoalTree)).toEqual([`Leaf (${ZWNJ}st)`, "Cars"]);
    expect(goalsToTree([null, null], t)).toEqual({});
  });

  test("two goals with the same display name and unit collide on one key (last wins)", () => {
    const first = entry("first", "Key\\A\\Same");
    const second = entry("second", "Key\\A\\Same");
    const tree = goalsToTree([first, second], t);
    expect(Object.keys(tree.A as GoalTree)).toHaveLength(1);
  });
});

test.describe("findSiblings", () => {
  type Candidate = Parameters<typeof findSiblings>[1];
  function goal(id: string, indicator: string, options: { unit?: string | null, listing?: GoalListing, noSeries?: boolean } = {}): Candidate {
    return {
      id,
      indicator_parameter: indicator,
      listing: options.listing ?? GoalListing.LISTED,
      data_series: options.noSeries ? null : { unit: options.unit === undefined ? "st" : options.unit },
    };
  }
  const ids = (goals: Candidate[]) => goals.map(g => g.id).sort();

  const self = goal("self", "Key\\Transport\\Cars\\Count");
  const sibling = goal("sibling", "Key\\Transport\\Cars\\Share");
  const demandSibling = goal("demand", "Demand\\Transport\\Cars\\Total");
  const otherUnit = goal("other-unit", "Key\\Transport\\Cars\\Mass", { unit: "ton" });
  const deeper = goal("deeper", "Key\\Transport\\Cars\\Count\\Electric");
  const shallower = goal("shallower", "Key\\Transport\\Cars");
  const cousin = goal("cousin", "Key\\Transport\\Buses\\Count");
  const unlisted = goal("unlisted", "Key\\Transport\\Cars\\Hidden", { listing: GoalListing.UNLISTED });
  const featured = goal("featured", "Key\\Transport\\Cars\\Star", { listing: GoalListing.FEATURED });

  test("siblings share the path, the level and the unit; Key and Demand are interchangeable", () => {
    const found = findSiblings([self, sibling, demandSibling, otherUnit, deeper, shallower, cousin, unlisted, featured], self);
    expect(ids(found)).toEqual(["demand", "featured", "sibling"]);
  });

  test("the goal itself is never its own sibling", () => {
    expect(findSiblings([self], self)).toEqual([]);
  });

  test("unlisted goals are left out of other goals' siblings", () => {
    expect(findSiblings([self, unlisted], self)).toEqual([]);
    // ... but an unlisted goal still finds its own listed siblings
    expect(ids(findSiblings([self, unlisted], unlisted))).toEqual(["self"]);
  });

  test("units must match exactly, including both being unitless or missing", () => {
    const unitless = goal("unitless", "Key\\A\\X", { unit: null });
    const unitlessToo = goal("unitless-too", "Key\\A\\Y", { unit: null });
    const noSeries = goal("no-series", "Key\\A\\Z", { noSeries: true });
    const noSeriesToo = goal("no-series-too", "Key\\A\\W", { noSeries: true });
    expect(ids(findSiblings([unitless, unitlessToo, noSeries, noSeriesToo], unitless))).toEqual(["unitless-too"]);
    expect(ids(findSiblings([unitless, unitlessToo, noSeries, noSeriesToo], noSeries))).toEqual(["no-series-too"]);
  });

  test("top-level goals are siblings of each other", () => {
    const a = goal("a", "Key\\A");
    const b = goal("b", "B");
    const c = goal("c", "Demand\\C");
    expect(ids(findSiblings([a, b, c], a))).toEqual(["b", "c"]);
  });

  test("the candidate prefixes cover every sibling, and top-level goals need no prefix", () => {
    const prefixes = siblingIndicatorPrefixes(self.indicator_parameter);
    expect(prefixes).toEqual(["Transport\\Cars\\", "Key\\Transport\\Cars\\", "Demand\\Transport\\Cars\\"]);
    for (const found of findSiblings([sibling, demandSibling, featured], self)) {
      expect(prefixes?.some(prefix => found.indicator_parameter.startsWith(prefix)), found.id).toBe(true);
    }
    expect(siblingIndicatorPrefixes("Key\\A")).toBeNull();
  });
});
