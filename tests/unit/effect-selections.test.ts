import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import * as selections from "../../src/fetchers/inclusionSelectors";
import { visibleEffectsWHERE } from "../../src/lib/accessFilters";
import { contexts } from "../lib/access-contexts";

/*
 * An effect joins an action and a goal that need not be visible to the same people, so a
 * reader that reaches effects through a goal or an action has to narrow them to the viewer
 * (`visibleEffectsWHERE`). Otherwise a public goal's page carries the name, years and author of
 * an action in someone's draft, and a shared-database action's page the goals of a closed
 * roadmap. Nothing in the types enforces it: a nested `effects: true` compiles. This walks
 * every selection in `inclusionSelectors.ts` and scans the fetchers' sources for the rest.
 */

/** Paths of every `effects` key whose value is not `{ where: <expected>, ... }` */
function unfilteredEffects(selection: unknown, expected: unknown, at: string): string[] {
  if (selection === null || typeof selection !== "object") return [];
  return Object.entries(selection as Record<string, unknown>).flatMap(([key, value]) => {
    const here = `${at}.${key}`;
    if (key !== "effects") return unfilteredEffects(value, expected, here);
    const where = value !== null && typeof value === "object" ? (value as { where?: unknown }).where : undefined;
    const filtered = JSON.stringify(where) === JSON.stringify(expected);
    // What hangs under the effect (its action or goal) is behind the filter; keep walking for nested effects
    return [...(filtered ? [] : [here]), ...unfilteredEffects(value, expected, here)];
  });
}

test.describe("selections that reach effects narrow them to the viewer", () => {
  const viewers = { anonymous: contexts.anonymous, member: contexts.member, superAdmin: contexts.superAdmin };

  for (const [name, selection] of Object.entries(selections)) {
    test(name, () => {
      if (typeof selection !== "function") {
        // A constant cannot know the viewer, so it may not select effects at all
        expect(unfilteredEffects(selection, Symbol("no filter can match"), name)).toEqual([]);
        return;
      }
      for (const [viewer, ctx] of Object.entries(viewers)) {
        expect(unfilteredEffects(selection(ctx), visibleEffectsWHERE(ctx), `${name}(${viewer})`)).toEqual([]);
      }
    });
  }

  test("the walker finds an unfiltered relation, count or nested effects", () => {
    const filter = visibleEffectsWHERE(null);
    expect(unfilteredEffects({ effects: true }, filter, "s")).toEqual(["s.effects"]);
    expect(unfilteredEffects({ _count: { select: { effects: true } } }, filter, "s")).toEqual(["s._count.select.effects"]);
    expect(unfilteredEffects({ goals: { select: { effects: { select: { action: true } } } } }, filter, "s")).toEqual(["s.goals.select.effects"]);
    expect(unfilteredEffects({ effects: { where: { action: {} }, select: {} } }, filter, "s")).toEqual(["s.effects"]);
    expect(unfilteredEffects({ effects: { where: filter, include: { goal: { include: { effects: true } } } } }, filter, "s")).toEqual(["s.effects.include.goal.include.effects"]);
    expect(unfilteredEffects({ effects: { where: filter }, _count: { select: { effects: { where: filter } } } }, filter, "s")).toEqual([]);
  });

  test("the selections under test do reach effects", () => {
    // Guards the walker against a rename: these are the six that read effects through a goal or an action
    const reaching = Object.entries(selections)
      .filter(([, selection]) => typeof selection === "function" && JSON.stringify(selection(null)).includes('"effects"'))
      .map(([name]) => name);
    expect(reaching.sort()).toEqual(["actionInclusionSelection", "clientSafeGoalSelection", "clientSafeRoadmapIterationSelection", "goalInclusionSelection", "relatedGoalSelection", "roadmapIterationInclusionSelection"]);
  });
});

test.describe("fetchers that name effects themselves", () => {
  const fetchers = path.join(process.cwd(), "src/fetchers");

  test("every `effects:` in a fetcher carries the filter, but for the goal reader's total", () => {
    // The fetchers are server-only, so this reads their sources. One exception: `getOneGoal` counts
    // every effect on the goal to say how many the viewer is not shown (`hidden_effect_count`).
    const offenders = fs.readdirSync(fetchers)
      .filter(file => file.endsWith(".ts") && file !== "inclusionSelectors.ts")
      .flatMap(file => fs.readFileSync(path.join(fetchers, file), "utf-8").split("\n")
        .map((line, index) => ({ at: `${file}:${index + 1}`, line: line.trim() }))
        .filter(({ line }) => /\beffects:\s*(true|\{)/.test(line) && !line.includes("visibleEffectsWHERE(")))
      .map(({ at, line }) => `${at} ${line}`);
    expect(offenders).toEqual([expect.stringMatching(/^getOneGoal\.ts:\d+ _count: \{ select: \{ effects: true \} \},$/)]);
  });

  test("the goal reader returns that total only as a count of what is hidden", () => {
    const source = fs.readFileSync(path.join(fetchers, "getOneGoal.ts"), "utf-8");
    expect(source).toContain("_count: { effects: visibleEffects },");
    expect(source).toContain("hidden_effect_count: Math.max(0, goal._count.effects - visibleEffects),");
  });
});
