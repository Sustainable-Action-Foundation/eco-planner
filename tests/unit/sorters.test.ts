import { expect, test } from "playwright/test";

import { goalDisplayName } from "../../src/functions/goalName";
import { RoadmapType } from "../../src/lib/prisma/generated";
import {
  actionGraphSorter,
  actionSorter,
  areaSorter,
  commentSorter,
  effectGraphSorter,
  effectSorter,
  goalSorter,
  goalSorterActionAmount,
  goalSorterActionAmountReverse,
  goalSorterInterest,
  goalSorterReverse,
  goalSorterTree,
  roadmapIterationSorter,
  roadmapSorter,
  roadmapSorterAZ,
  roadmapSorterGoalAmount,
} from "../../src/lib/sorters";
import type { Action, Goal } from "../../src/types";

/*
 * The comparators share one Swedish, numeric, case-insensitive collator. Each
 * test sorts a deliberately shuffled list and asserts the resulting order.
 */

const names = <T extends { name: string }>(items: T[]) => items.map(item => item.name);

test.describe("roadmap sorters", () => {
  const roadmaps = [
    { type: RoadmapType.OTHER, name: "Övrigt" },
    { type: RoadmapType.MUNICIPAL, name: "Boden" },
    { type: RoadmapType.NATIONAL, name: "Sverige" },
    { type: RoadmapType.REGIONAL, name: "Norrbotten" },
    { type: RoadmapType.LOCAL, name: "Lokal" },
    { type: RoadmapType.ORGANIZATIONAL, name: "Org" },
    { type: RoadmapType.MUNICIPAL, name: "Älvsbyn" },
    { type: RoadmapType.MUNICIPAL, name: "arjeplog" },
  ];

  test("roadmapSorter puts national first, then the enum order, then Swedish alphabetical", () => {
    expect(names([...roadmaps].sort(roadmapSorter))).toEqual(["Sverige", "Norrbotten", "arjeplog", "Boden", "Älvsbyn", "Lokal", "Org", "Övrigt"]);
  });

  test("roadmapSorter compares names numerically", () => {
    const numbered = [{ type: RoadmapType.OTHER, name: "Plan 10" }, { type: RoadmapType.OTHER, name: "Plan 2" }, { type: RoadmapType.OTHER, name: "Plan 1" }];
    expect(names(numbered.sort(roadmapSorter))).toEqual(["Plan 1", "Plan 2", "Plan 10"]);
  });

  test("roadmapIterationSorter orders by roadmap type and name, then higher version first", () => {
    const iterations = [
      { roadmap: { type: RoadmapType.MUNICIPAL, name: "Boden" }, version: 1 },
      { roadmap: { type: RoadmapType.NATIONAL, name: "Sverige" }, version: 1 },
      { roadmap: { type: RoadmapType.MUNICIPAL, name: "Boden" }, version: 3 },
      { roadmap: { type: RoadmapType.MUNICIPAL, name: "Arvidsjaur" }, version: 1 },
      { roadmap: { type: RoadmapType.NATIONAL, name: "Sverige" }, version: 2 },
      { roadmap: { type: RoadmapType.MUNICIPAL, name: "Boden" }, version: 2 },
    ];
    expect(iterations.sort(roadmapIterationSorter).map(it => `${it.roadmap.name} v${it.version}`))
      .toEqual(["Sverige v2", "Sverige v1", "Arvidsjaur v1", "Boden v3", "Boden v2", "Boden v1"]);
  });

  test("roadmapSorterAZ ignores type", () => {
    const wrapped = roadmaps.map(roadmap => ({ roadmap }));
    expect(wrapped.sort(roadmapSorterAZ).map(w => w.roadmap.name)).toEqual(["arjeplog", "Boden", "Lokal", "Norrbotten", "Org", "Sverige", "Älvsbyn", "Övrigt"]);
  });

  test("roadmapSorterGoalAmount puts the most goals first and breaks ties by name", () => {
    const counted = [
      { roadmap: { name: "B" }, _count: { goals: 2 } },
      { roadmap: { name: "A" }, _count: { goals: 2 } },
      { roadmap: { name: "C" }, _count: { goals: 5 } },
      { roadmap: { name: "D" }, _count: { goals: 0 } },
    ];
    expect(counted.sort(roadmapSorterGoalAmount).map(r => r.roadmap.name)).toEqual(["C", "A", "B", "D"]);
  });
});

test.describe("goal sorters", () => {
  const goals = [
    { name: null, indicator_parameter: "Key\\B\\Beta" },
    { name: "Zeta", indicator_parameter: "Key\\Z" },
    { name: "alfa", indicator_parameter: "Key\\A" },
    { name: null, indicator_parameter: "Key\\A\\Alpha" },
    { name: "", indicator_parameter: "Key\\C\\Gamma" },
  ];
  const label = (goal: { name: string | null, indicator_parameter: string }) => goal.name || goal.indicator_parameter;

  test("goalSorter: named goals first (alphabetically), then unnamed by indicator parameter", () => {
    expect([...goals].sort(goalSorter).map(label)).toEqual(["alfa", "Zeta", "Key\\A\\Alpha", "Key\\B\\Beta", "Key\\C\\Gamma"]);
  });

  test("goalSorter: an empty name counts as no name, like goalDisplayName", () => {
    const blank = { name: "", indicator_parameter: "Key\\X" };
    const named = { name: "Y", indicator_parameter: "Key\\A" };
    expect(goalSorter(named, blank)).toBeLessThan(0);
    expect(goalDisplayName(blank)).toBe("X");
  });

  test("goalSorterReverse: named still first, each group reversed", () => {
    expect(([...goals] as Goal[]).sort(goalSorterReverse).map(label)).toEqual(["Zeta", "alfa", "Key\\C\\Gamma", "Key\\B\\Beta", "Key\\A\\Alpha"]);
  });

  test("goalSorterTree: leaves before branches under a common parent, otherwise alphabetical", () => {
    const tree = [
      { indicator_parameter: "Example\\Parameter\\A\\Test" },
      { indicator_parameter: "Example\\Parameter\\B" },
      { indicator_parameter: "Example\\Test\\A" },
      { indicator_parameter: "Example\\Parameter\\A" },
    ];
    expect(tree.sort(goalSorterTree).map(g => g.indicator_parameter)).toEqual([
      "Example\\Parameter\\A",
      "Example\\Parameter\\B",
      "Example\\Parameter\\A\\Test",
      "Example\\Test\\A",
    ]);
  });

  test("goalSorterTree: against a single-segment parameter the root segment decides", () => {
    // "a" and "a\\x" share the root, so the shorter one leads; "b" is compared alphabetically on the whole path
    const flat = [{ indicator_parameter: "b" }, { indicator_parameter: "a" }, { indicator_parameter: "a\\x" }];
    expect(flat.sort(goalSorterTree).map(g => g.indicator_parameter)).toEqual(["a", "a\\x", "b"]);
  });

  test("goalSorterActionAmount and its reverse", () => {
    const counted = [{ id: 1, _count: { effects: 1 } }, { id: 2, _count: { effects: 3 } }, { id: 3, _count: { effects: 0 } }, { id: 4, _count: { effects: 3 } }];
    expect([...counted].sort(goalSorterActionAmount).map(g => g._count.effects)).toEqual([3, 3, 1, 0]);
    expect([...counted].sort(goalSorterActionAmountReverse).map(g => g._count.effects)).toEqual([0, 1, 3, 3]);
    expect(goalSorterActionAmount(counted[1], counted[3])).toBe(0);
  });

  test("goalSorterInterest: steeper recent change first, goals without a series last", () => {
    const series = (values: Record<number, number>) => ({
      id: "s",
      unit: null,
      values: Object.entries(values).map(([year, value]) => ({ timestamp: new Date(`${year}-01-01T00:00:00.000Z`), value })),
    });
    const thisYear = new Date().getUTCFullYear();
    const steep = { name: "steep", data_series: series({ [thisYear]: 0, [thisYear + 1]: 100 }) };
    const flat = { name: "flat", data_series: series({ [thisYear]: 5, [thisYear + 1]: 5 }) };
    const far = { name: "far", data_series: series({ [thisYear + 20]: 0, [thisYear + 21]: 100 }) };
    const none = { name: "none", data_series: null };
    expect(names([none, flat, far, steep].sort(goalSorterInterest))).toEqual(["steep", "far", "flat", "none"]);
    expect(goalSorterInterest(none, { ...none })).toBe(0);
  });
});

test.describe("action and effect sorters", () => {
  test("actionSorter and effectSorter sort by (action) name", () => {
    const actions = [{ name: "b" }, { name: "A" }, { name: "ä" }, { name: "10" }, { name: "9" }] as Action[];
    expect(names([...actions].sort(actionSorter))).toEqual(["9", "10", "A", "b", "ä"]);
    expect(actions.map(action => ({ action })).sort(effectSorter).map(e => e.action.name)).toEqual(["9", "10", "A", "b", "ä"]);
  });

  test("actionGraphSorter: start year, end year, then name; missing years count as zero", () => {
    const points = [
      { x: "late", y: [2030, 2040] },
      { x: "short", y: [2020, 2025] },
      { x: "long", y: [2020, 2030] },
      { x: "b-same", y: [2020, 2025] },
      { x: "open", y: [] },
    ];
    expect(points.sort(actionGraphSorter).map(p => p.x)).toEqual(["open", "b-same", "short", "long", "late"]);
  });

  test("effectGraphSorter: action start year, end year, then name", () => {
    const effects = [
      { action: { name: "c", startYear: 2025, endYear: 2030 } },
      { action: { name: "b", startYear: 2020, endYear: 2030 } },
      { action: { name: "a", startYear: 2020, endYear: 2030 } },
      { action: { name: "d", startYear: 2020, endYear: 2021 } },
    ];
    expect(effects.sort(effectGraphSorter).map(e => e.action.name)).toEqual(["d", "a", "b", "c"]);
  });
});

test.describe("comment and area sorters", () => {
  test("commentSorter: newest first, from Date objects or serialized strings", () => {
    const comments = [
      { id: "old", created_at: new Date("2024-01-01T10:00:00Z") },
      { id: "new", created_at: "2025-06-01T10:00:00.000Z" },
      { id: "mid", created_at: new Date("2024-12-31T23:59:59Z") },
    ];
    expect(comments.sort(commentSorter).map(c => c.id)).toEqual(["new", "mid", "old"]);
    expect(commentSorter({ created_at: "2024-01-01T10:00:00Z" }, { created_at: new Date("2024-01-01T10:00:00Z") })).toBe(0);
  });

  test("areaSorter: the national area first, then alphabetical", () => {
    const areas: [string, string][] = [["Uppsala län", "03"], ["Sverige", "00"], ["Blekinge län", "10"], ["Örebro län", "18"]];
    expect(areas.sort(areaSorter).map(a => a[0])).toEqual(["Sverige", "Blekinge län", "Uppsala län", "Örebro län"]);
    expect(areaSorter(["B", "00"], ["A", "00"])).toBeGreaterThan(0);
  });
});
