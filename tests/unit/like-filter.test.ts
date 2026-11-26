import { expect, test } from "playwright/test";
import type { TFunction } from "i18next";

import goalsToTree from "../../src/functions/goalsToTree";
import { countTreeGoals, defaultLikeFilter, likeFilterHref, onlyLiked, parseLikeFilter, resolveLikeFilter, wantsLikeFilter } from "../../src/functions/likeFilter";
import { LikeFilter, LikeScope } from "../../src/types/enums";
import type { GoalTree, GoalTreeEntry } from "../../src/types";

/*
 * The liked-goals filter of a roadmap version's goal list: `?likes=` names
 * whose likes count, the list keeps the goals with a like among them, and the
 * tree built from what is left has no branch without a liked goal.
 */

const t = ((key: string) => key) as unknown as TFunction;

function entry(id: string, indicator: string): GoalTreeEntry {
  return { id, name: null, indicator_parameter: indicator, data_series: { id: `${id}-series`, unit: "st" } } as unknown as GoalTreeEntry;
}

const goals = [
  entry("cars-count", "Key\\Transport\\Cars\\Count"),
  entry("cars-share", "Key\\Transport\\Cars\\Share"),
  entry("buses", "Key\\Transport\\Buses\\Count"),
  entry("heat", "Key\\Energy\\Heat"),
  entry("lonely", "Lonely"),
];

test.describe("the ?likes= param", () => {
  test("names a filter in any case, and nothing else", () => {
    expect(parseLikeFilter("org")).toBe(LikeFilter.Org);
    expect(parseLikeFilter("COUNTY")).toBe(LikeFilter.County);
    expect(parseLikeFilter("Mine")).toBe(LikeFilter.Mine);
    expect(parseLikeFilter(["all", "org"])).toBe(LikeFilter.All);
    expect(parseLikeFilter("everyone")).toBeNull();
    expect(parseLikeFilter("")).toBeNull();
    expect(parseLikeFilter(undefined)).toBeNull();
  });

  test("shares the org landing's scopes", () => {
    for (const scope of Object.values(LikeScope)) {
      expect(parseLikeFilter(scope.toLowerCase())).toBe(scope);
    }
  });

  test("turns the filter on by being there", () => {
    expect(wantsLikeFilter(undefined)).toBe(false);
    expect(wantsLikeFilter([])).toBe(false);
    expect(wantsLikeFilter("")).toBe(true);
    expect(wantsLikeFilter("org")).toBe(true);
  });
});

test.describe("the filter in use", () => {
  const member = [LikeFilter.Mine, LikeFilter.Org, LikeFilter.Area, LikeFilter.County, LikeFilter.All];
  const unplaced = [LikeFilter.Mine, LikeFilter.Org, LikeFilter.All];
  const orgless = [LikeFilter.Mine, LikeFilter.All];

  test("defaults to the org's own likes, and to everyone's without an org", () => {
    expect(defaultLikeFilter(member)).toBe(LikeFilter.Org);
    expect(defaultLikeFilter(unplaced)).toBe(LikeFilter.Org);
    expect(defaultLikeFilter(orgless)).toBe(LikeFilter.All);
    expect(defaultLikeFilter([LikeFilter.Mine])).toBe(LikeFilter.Mine);
    expect(defaultLikeFilter([])).toBeNull();
  });

  test("is none without the param", () => {
    expect(resolveLikeFilter(undefined, member)).toBeNull();
  });

  test("is the named one when the viewer has it", () => {
    expect(resolveLikeFilter("county", member)).toBe(LikeFilter.County);
    expect(resolveLikeFilter("mine", orgless)).toBe(LikeFilter.Mine);
  });

  test("falls back to the viewer's default for one they lack or an unknown one", () => {
    expect(resolveLikeFilter("county", unplaced)).toBe(LikeFilter.Org);
    expect(resolveLikeFilter("org", orgless)).toBe(LikeFilter.All);
    expect(resolveLikeFilter("nonsense", member)).toBe(LikeFilter.Org);
    expect(resolveLikeFilter("", member)).toBe(LikeFilter.Org);
  });

  test("is none for a viewer without any filter", () => {
    expect(resolveLikeFilter("org", [])).toBeNull();
  });
});

test.describe("links between the list's states", () => {
  const path = "/roadmap/abc/v2";

  test("set, replace and drop the filter", () => {
    expect(likeFilterHref(path, {}, LikeFilter.Org)).toBe(`${path}?likes=org`);
    expect(likeFilterHref(path, { likes: "org" }, LikeFilter.County)).toBe(`${path}?likes=county`);
    expect(likeFilterHref(path, { likes: "org" }, null)).toBe(path);
  });

  test("keep the page's other params, the org the likes are seen from among them", () => {
    expect(likeFilterHref(path, { org: "o1", likes: "area" }, LikeFilter.Mine)).toBe(`${path}?org=o1&likes=mine`);
    expect(likeFilterHref(path, { org: "o1", likes: "area" }, null)).toBe(`${path}?org=o1`);
    expect(likeFilterHref(path, { tag: ["a", "b"], empty: undefined }, LikeFilter.All)).toBe(`${path}?tag=a&tag=b&likes=all`);
  });
});

test.describe("only liked goals", () => {
  test("keeps the goals with a like and their order", () => {
    expect(onlyLiked(goals, { "cars-share": 2, heat: 1 }).map(goal => goal.id)).toEqual(["cars-share", "heat"]);
  });

  test("drops goals without a count or with none, and ignores counts for goals not in the list", () => {
    expect(onlyLiked(goals, { "cars-count": 0, elsewhere: 5 })).toEqual([]);
    expect(onlyLiked(goals, {})).toEqual([]);
  });

  test("leaves no branch without a liked goal in the tree", () => {
    const tree = goalsToTree(onlyLiked(goals, { "cars-share": 2, heat: 1 }), t);
    // Buses and the lonely goal's branch are gone, and so is the unliked sibling under Cars
    expect(Object.keys(tree).sort()).toEqual(["Energy", "Transport"]);
    expect(Object.keys(tree.Transport as GoalTree)).toEqual(["Cars"]);
    const cars = (tree.Transport as GoalTree).Cars as GoalTree;
    expect(Object.values(cars).map(goal => goal.id)).toEqual(["cars-share"]);
  });

  test("keeps the branches of the whole tree for the goals that stay", () => {
    const whole = goalsToTree([...goals], t);
    const liked = goalsToTree(onlyLiked(goals, { buses: 1, lonely: 3 }), t);
    expect(liked.Lonely).toEqual(whole.Lonely);
    expect((liked.Transport as GoalTree).Buses).toEqual((whole.Transport as GoalTree).Buses);
  });
});

test.describe("goals per branch", () => {
  test("counts the goals under a branch at any depth", () => {
    const tree = goalsToTree([...goals], t);
    expect(countTreeGoals(tree)).toBe(5);
    expect(countTreeGoals(tree.Transport as GoalTree)).toBe(3);
    expect(countTreeGoals((tree.Transport as GoalTree).Cars as GoalTree)).toBe(2);
    expect(countTreeGoals(tree.Lonely as GoalTree)).toBe(1);
    expect(countTreeGoals({})).toBe(0);
  });
});
