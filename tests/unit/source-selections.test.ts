import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import { readsUndeliveredSeries, withoutHiddenSources } from "../../src/fetchers/hiddenSources";
import * as selections from "../../src/fetchers/inclusionSelectors";
import { Recipe } from "../../src/functions/recipe/recipe";
import { visibleSourceSeriesWHERE } from "../../src/lib/accessFilters";
import type { DataSeries } from "../../src/types";
import { contexts } from "../lib/access-contexts";

/*
 * A series can be computed by a recipe from other stored series (a copy of a goal reads the
 * original's series), and the two need not be visible to the same people. A reader that hands
 * out a series' recipe therefore has to (1) narrow `source_data_series` to the viewer
 * (`visibleSourceSeriesWHERE`) and (2) return through `withoutHiddenSources`, which takes out a
 * recipe that names a series the viewer did not get. Otherwise a public goal's page carries the
 * values, the series id and the name of a goal under someone's closed roadmap. Nothing in the
 * types enforces either: `source_data_series: true` compiles, and so does a reader that returns
 * the query's result as is. This walks every selection in `inclusionSelectors.ts` and scans the
 * fetchers' sources for the rest.
 */

const SOURCES = "source_data_series";
const viewers = { anonymous: contexts.anonymous, member: contexts.member, editor: contexts.memberRW, superAdmin: contexts.superAdmin };

/** `${name}`: how an equation refers to a variable */
const ref = (name: string) => `\${${name}}`;

/** Paths of every `source_data_series` key whose value is not `{ where: <expected>, ... }` */
function unfilteredSources(selection: unknown, expected: unknown, at: string): string[] {
  if (selection === null || typeof selection !== "object") return [];
  return Object.entries(selection as Record<string, unknown>).flatMap(([key, value]) => {
    const here = `${at}.${key}`;
    if (key !== SOURCES) return unfilteredSources(value, expected, here);
    const where = value !== null && typeof value === "object" ? (value as { where?: unknown }).where : undefined;
    const filtered = JSON.stringify(where) === JSON.stringify(expected);
    return [...(filtered ? [] : [here]), ...unfilteredSources(value, expected, here)];
  });
}

/** The exported selections that carry a series' recipe with its sources, by name */
const carrying = Object.entries(selections)
  .filter(([, selection]) => JSON.stringify(typeof selection === "function" ? selection(null) : selection).includes(`"${SOURCES}"`))
  .map(([name]) => name);

test.describe("selections that carry a series' sources narrow them to the viewer", () => {
  for (const [name, selection] of Object.entries(selections)) {
    test(name, () => {
      if (typeof selection !== "function") {
        // A constant cannot know the viewer, so it may not select sources at all
        expect(unfilteredSources(selection, Symbol("no filter can match"), name)).toEqual([]);
        return;
      }
      for (const [viewer, ctx] of Object.entries(viewers)) {
        expect(unfilteredSources(selection(ctx), visibleSourceSeriesWHERE(ctx), `${name}(${viewer})`)).toEqual([]);
      }
    });
  }

  test("the walker finds an unfiltered relation, a count, a wrong filter and a nested one", () => {
    const filter = visibleSourceSeriesWHERE(null);
    expect(unfilteredSources({ [SOURCES]: true }, filter, "s")).toEqual([`s.${SOURCES}`]);
    expect(unfilteredSources({ recipe_used: { select: { [SOURCES]: { select: { id: true } } } } }, filter, "s")).toEqual([`s.recipe_used.select.${SOURCES}`]);
    expect(unfilteredSources({ _count: { select: { [SOURCES]: true } } }, filter, "s")).toEqual([`s._count.select.${SOURCES}`]);
    expect(unfilteredSources({ [SOURCES]: { where: { id: "x" }, select: {} } }, filter, "s")).toEqual([`s.${SOURCES}`]);
    expect(unfilteredSources({ [SOURCES]: { where: filter, select: { recipe_used: { select: { [SOURCES]: true } } } } }, filter, "s")).toEqual([`s.${SOURCES}.select.recipe_used.select.${SOURCES}`]);
    expect(unfilteredSources({ [SOURCES]: { where: filter, select: { id: true } } }, filter, "s")).toEqual([]);
  });

  test("the selections under test do carry sources", () => {
    // Guards the walker against a rename: these are the six that hand out a series with its recipe
    expect([...carrying].sort()).toEqual(["actionInclusionSelection", "clientSafeGoalSelection", "clientSafeRoadmapIterationSelection", "effectInclusionSelection", "goalInclusionSelection", "roadmapIterationInclusionSelection"]);
  });

  test("every recipe a selection carries comes with its sources: the readers compare the two", () => {
    // `withoutHiddenSources` looks at `recipe_used: { recipe, source_data_series }`. A selection that
    // took the recipe without the sources would pass it by unchecked.
    const recipesWithoutSources = (selection: unknown, at: string): string[] => {
      if (selection === null || typeof selection !== "object") return [];
      return Object.entries(selection as Record<string, unknown>).flatMap(([key, value]) => {
        const here = `${at}.${key}`;
        if (key !== "recipe_used") return recipesWithoutSources(value, here);
        const select = value !== null && typeof value === "object" ? (value as { select?: Record<string, unknown> }).select : undefined;
        return select && "recipe" in select && SOURCES in select ? [] : [here];
      });
    };
    for (const [name, selection] of Object.entries(selections)) {
      expect(recipesWithoutSources(typeof selection === "function" ? selection(null) : selection, name), name).toEqual([]);
    }
    expect(recipesWithoutSources({ data_series: { include: { recipe_used: true } } }, "s")).toEqual(["s.data_series.include.recipe_used"]);
    expect(recipesWithoutSources({ recipe_used: { select: { recipe: true } } }, "s")).toEqual(["s.recipe_used"]);
  });
});

test.describe("fetchers", () => {
  const fetchers = path.join(process.cwd(), "src/fetchers");
  // The fetchers are server-only, so this reads their sources
  const sources = fs.readdirSync(fetchers)
    .filter(file => file.endsWith(".ts") && file !== "inclusionSelectors.ts" && file !== "hiddenSources.ts")
    .map(file => ({ file, source: fs.readFileSync(path.join(fetchers, file), "utf-8") }));

  test("every reader that uses a selection carrying sources returns through withoutHiddenSources", () => {
    const readers = sources.filter(({ source }) => carrying.some(name => new RegExp(`\\b${name}\\(`).test(source)));
    expect(readers.map(({ file }) => file).sort()).toEqual([
      "clientSafeGetOneGoal.ts", "clientSafeGetOneRoadmapIteration.ts", "getActions.ts", "getOneAction.ts",
      "getOneEffect.ts", "getOneGoal.ts", "getOneRoadmapIteration.ts", "getRoadmapIterationByVersion.ts",
    ]);
    for (const { file, source } of readers) {
      const uses = carrying.reduce((count, name) => count + (source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0), 0);
      const returns = source.match(/\breturn withoutHiddenSources\(/g)?.length ?? 0;
      expect(returns, `${file} returns through withoutHiddenSources`).toBeGreaterThan(0);
      // One cached function per reader file: whatever number of queries it has, they all end in that return
      expect(source.match(/'use cache';/g)?.length ?? 0, `${file}: cached scopes`).toBe(1);
      expect(source.match(/\n {4}return (?!withoutHiddenSources\()[^;\n]*;\n {2}\}\);/g) ?? [], `${file}: a cached fill that returns its result as is (${uses} selection uses)`).toEqual([]);
    }
  });

  test("what decides a source's visibility expires those readers: they declare the tags", () => {
    // A source is hidden or shown by its own roadmap's sharing and version status, and by whether
    // its goal or effect still exists: none of which touches the series computed from it
    for (const { file, source } of sources.filter(({ source }) => source.includes("withoutHiddenSources("))) {
      const tags = source.match(/cacheTag\(('[^)]*)\)/)?.[1] ?? "";
      for (const tag of ["roadmap", "roadmapIteration", "goal", "action", "dataSeries"]) {
        expect(tags.includes(`'${tag}'`), `${file} declares '${tag}'`).toBe(true);
      }
    }
  });

  test("no fetcher names source_data_series itself, but for the copies lookup's ids", () => {
    // `findCopies` (getGoalLikes) asks which of the org's goals read the series of goals the viewer
    // was just shown: a filter on those ids and nothing but the ids back
    const offenders = sources.flatMap(({ file, source }) => source.split("\n")
      .map((line, index) => ({ at: `${file}:${index + 1}`, line: line.trim() }))
      .filter(({ line }) => line.includes(`${SOURCES}:`) && !line.includes("visibleSourceSeriesWHERE("))
      .map(({ at, line }) => `${at} ${line}`));
    expect(offenders).toEqual([
      expect.stringMatching(/^getGoalLikes\.ts:\d+ data_series: \{ recipe_used: \{ source_data_series: \{ some: \{ id: \{ in: sourceSeriesIds \} \} \} \} \},$/),
      expect.stringMatching(/^getGoalLikes\.ts:\d+ data_series: \{ select: \{ recipe_used: \{ select: \{ source_data_series: \{ where: \{ id: \{ in: sourceSeriesIds \} \}, select: \{ id: true \} \} \} \} \} \},$/),
    ]);
  });
});

test.describe("a recipe that names a series the viewer did not get is taken out", () => {
  const HIDDEN = "11111111-1111-4111-8111-111111111111";
  const SHOWN = "22222222-2222-4222-8222-222222222222";
  const linked = (id: string, dataSeriesId: string | null, extra: Record<string, unknown> = {}) =>
    ({ id, name: `Goal ${id}`, type: "data-series", pick: "whole", unit: "ton", dataSeriesId, value: null, ...extra });
  const scalar = { id: "k", name: "Factor", type: "scalar", unit: "UNITLESS", value: 2 };
  const recipe = (variables: unknown[]) => ({ name: "Scaled copy", equation: `${ref("Goal a")} * ${ref("Factor")}`, variables, unit: "ton", meta: { v: 1, isSuggestedRecipe: true, isManual: false } });
  const statistics = { dataset: "SCB", tableId: "TAB1", selection: [] };

  test("what counts as reading an undelivered series", () => {
    const delivered = new Set([SHOWN]);
    expect(readsUndeliveredSeries(recipe([linked("a", SHOWN), scalar]), delivered), "a delivered source").toBe(false);
    expect(readsUndeliveredSeries(recipe([linked("a", HIDDEN), scalar]), delivered), "a source left out").toBe(true);
    expect(readsUndeliveredSeries(recipe([linked("a", SHOWN), linked("b", HIDDEN)]), delivered), "one of two left out").toBe(true);
    expect(readsUndeliveredSeries(recipe([scalar]), delivered), "scalars only").toBe(false);
    expect(readsUndeliveredSeries(recipe([linked("a", null, { value: { "2020-01-01T00:00:00.000Z": 1 } })]), delivered), "a hand-entered series").toBe(false);
    // Fetched statistics name a public table; their series is delivered only to editors
    expect(readsUndeliveredSeries(recipe([linked("a", HIDDEN, { externalSource: statistics })]), delivered), "fetched statistics, materialized").toBe(false);
    expect(readsUndeliveredSeries(recipe([{ ...linked("a", HIDDEN), type: "external", ...statistics }]), delivered), "fetched statistics, editable").toBe(false);
    expect(readsUndeliveredSeries(recipe([linked("a", HIDDEN, { externalSource: statistics }), linked("b", HIDDEN)]), delivered), "statistics next to a source left out").toBe(true);
    // The column holds a serialized string (the app) or an object (hand-written SQL); the old type spelling reads the same
    expect(readsUndeliveredSeries(JSON.stringify(recipe([linked("a", HIDDEN)])), delivered), "serialized").toBe(true);
    expect(readsUndeliveredSeries(JSON.stringify(recipe([linked("a", SHOWN)])), delivered), "serialized, delivered").toBe(false);
    expect(readsUndeliveredSeries(recipe([{ ...linked("a", HIDDEN), type: "dataSeries" }]), delivered), "legacy type spelling").toBe(true);
    // What cannot be read cannot be shown to be harmless
    for (const unreadable of [null, undefined, 7, "not json", "[]", {}, { variables: "x" }, recipe(["x"])]) {
      expect(readsUndeliveredSeries(unreadable, delivered), `unreadable: ${JSON.stringify(unreadable)}`).toBe(true);
    }
  });

  test("the recipe is replaced by an empty one wherever the series sits; values and everything else stay", () => {
    const series = (variables: unknown[], sources: string[], serialized = true) => ({
      id: "series",
      unit: "ton",
      values: [{ timestamp: new Date("2020-01-01"), value: 4 }],
      recipe_used: { id: "recipe", recipe: serialized ? JSON.stringify(recipe(variables)) : recipe(variables), source_data_series: sources.map(id => ({ id, unit: "ton", values: [] })) },
    });
    const visible = series([linked("a", SHOWN), scalar], [SHOWN]);
    const visibleRecipe = visible.recipe_used.recipe;
    const result = {
      id: "goal",
      updated_at: new Date("2026-01-01"),
      data_series: series([linked("a", HIDDEN), scalar], []),
      baseline: series([linked("a", HIDDEN)], [], false),
      historical: visible,
      effects: [{ action: { name: "Action" }, data_series: series([linked("a", SHOWN), linked("b", HIDDEN)], [SHOWN]) }],
      goals: [{ data_series: null }, null],
    };
    const returned = withoutHiddenSources(result);
    expect(returned, "in place").toBe(result);

    for (const [where, taken] of [["data_series", result.data_series], ["baseline", result.baseline], ["effect", result.effects[0].data_series]] as const) {
      // Replaced recipes are serialized strings, whatever shape the stored one had
      expect(typeof taken.recipe_used.recipe, `${where}: serialized`).toBe("string");
      const empty = Recipe.from(taken.recipe_used.recipe as string);
      expect(empty.isEmpty(), `${where}: an empty recipe`).toBe(true);
      expect(JSON.stringify(taken).includes(HIDDEN), `${where}: the hidden id`).toBe(false);
      expect(JSON.stringify(taken).includes("Goal a"), `${where}: the label`).toBe(false);
      expect(taken.values, `${where}: the series' own values`).toEqual([{ timestamp: new Date("2020-01-01"), value: 4 }]);
      expect(taken.recipe_used.id, `${where}: the recipe id`).toBe("recipe");
    }
    expect(result.effects[0].data_series.recipe_used.source_data_series.map(source => source.id), "delivered sources stay").toEqual([SHOWN]);
    expect(result.historical.recipe_used.recipe, "a recipe whose sources were all delivered is untouched").toBe(visibleRecipe);
    expect(result.updated_at).toEqual(new Date("2026-01-01"));
    expect(withoutHiddenSources(null)).toBeNull();
    expect(withoutHiddenSources([])).toEqual([]);
  });

  test("the empty recipe cannot be evaluated, so a form given it has no series to save", async () => {
    const taken = { recipe_used: { recipe: JSON.stringify(recipe([linked("a", HIDDEN)])), source_data_series: [] } };
    withoutHiddenSources(taken);
    await expect(Recipe.from(taken.recipe_used.recipe).evaluate([])).rejects.toThrow("Equation is empty");
  });
});

test.describe("a recipe is evaluated from all of its sources or not at all", () => {
  // The other half of filtering sources per viewer: no evaluation may quietly go on without a
  // source it was not given. Recalculation (`/api/recalculate`) and the forms both resolve linked
  // series through a getter that answers null for a series the user may not read.
  const SEEN = "33333333-3333-4333-8333-333333333333";
  const UNSEEN = "44444444-4444-4444-8444-444444444444";
  const getter = (id: string): Promise<DataSeries | null> => Promise.resolve(id === SEEN
    ? { id, unit: "ton", values: [{ data_series_id: id, timestamp: new Date("2020-01-01T00:00:00Z"), value: 10 }] }
    : null);
  const variable = (id: string, dataSeriesId: string) => ({ id, name: id, type: "data-series" as const, pick: "whole" as const, unit: "ton" as const, dataSeriesId, value: null });

  test("one unreadable source out of two rejects the evaluation, whatever the equation does with it", async () => {
    for (const equation of [`${ref("a")} + ${ref("b")}`, ref("a"), `${ref("a")} + 0 * ${ref("b")}`]) {
      const recipe = Recipe.from({ name: "Sum", equation, variables: [variable("a", SEEN), variable("b", UNSEEN)], unit: "ton", meta: { v: 1 } });
      await expect(recipe.evaluate([], { dataSeriesGetter: getter }), equation).rejects.toThrow("Failed to fetch data series");
    }
    const readable = Recipe.from({ name: "One", equation: `${ref("a")} * 2`, variables: [variable("a", SEEN)], unit: "ton", meta: { v: 1 } });
    expect(Object.values((await readable.evaluate([], { dataSeriesGetter: getter }))?.dateValues ?? {})).toEqual([20]);
  });
});
