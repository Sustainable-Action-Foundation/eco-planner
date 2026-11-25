/* eslint-disable no-template-curly-in-string */
import { expect, test } from "playwright/test";

import { legacyTypePlanToReport, legacyTypePlanToSql, planLegacyTypeRewrites, StoredShape } from "../../scripts/lib/legacyRecipeTypes";
import { legacyRecipeDataTypes, withCurrentVariableTypes } from "../../src/functions/recipe/legacyTypes";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { RecipeError } from "../../src/functions/recipe/types/errors";
import { isRecipe } from "../../src/functions/recipe/types/typeguards";
import type { JSONValue } from "../../src/types";

/*
 * Stored recipes can carry a variable `type` from before a rename ("dataSeries",
 * today "data-series"). Recipe.from accepts the named legacy spellings and
 * nothing else; serializing writes the current one. The second half covers the
 * plan behind scripts/maintenance/rewrite-legacy-recipe-types.ts.
 */

const seriesId = "0003ad38-5a52-4299-8986-ed48940b5330";

/** A recipe as the levelling SQL's JSON_OBJECT stored it for a recipe-less series: the column text, MariaDB's spacing included */
const levelledText = `{"name": "Manual data series", "equation": "\${${seriesId}}", "variables": [{"id": "${seriesId}", "name": "Manual data series", "type": "dataSeries", "pick": "whole", "unit": "procent", "dataSeriesId": null, "value": {"2020-01-01T00:00:00.000Z":91.68, "2021-01-01T00:00:00.000Z":92.5}}], "unit": "procent", "meta": {"v": 1, "isManual": true}}`;
const levelled = (): JSONValue => JSON.parse(levelledText) as JSONValue;

/** A recipe the app itself saved before the rename: a scalar and a linked series */
const linkedLegacy = (): JSONValue => ({
  name: "Scaled",
  equation: "${k} * ${parent}",
  variables: [
    { id: "k", name: "Factor", type: "scalar", value: 2, unit: null },
    { id: "parent", name: "Parent", type: "dataSeries", pick: "whole", unit: "kg", dataSeriesId: seriesId, value: null },
  ],
  unit: "kg",
  meta: { v: 1, isSuggestedRecipe: false },
});

const withVariableType = (type: JSONValue): JSONValue => {
  const recipe = levelled() as { variables: Record<string, JSONValue>[] };
  recipe.variables[0].type = type;
  return recipe;
};

test.describe("legacy variable types when reading", () => {
  test("the guard itself stays strict: it rejects the legacy spelling", () => {
    expect(isRecipe(levelled())).toBe(false);
    expect(isRecipe(linkedLegacy())).toBe(false);
  });

  test("Recipe.from parses a legacy recipe in every stored shape", async () => {
    const shapes: JSONValue[] = [
      levelled(), // a plain object, as hand-written SQL stored it
      levelledText, // serialized
      { id: "db-id", recipe: levelled() }, // db row holding an object
      { id: "db-id", recipe: levelledText }, // db row holding the serialized recipe
    ];

    for (const shape of shapes) {
      const recipe = Recipe.from(shape);
      expect(recipe.isManual()).toBe(true);
      expect(recipe.unit).toBe("procent");
      expect(recipe.variables).toHaveLength(1);
      expect(recipe.variables[0].type).toBe(RecipeDataTypes.DataSeries);

      const evaluated = await recipe.evaluate();
      expect(evaluated).toEqual({
        unit: "procent",
        dateValues: { "2020-01-01T00:00:00.000Z": 91.68, "2021-01-01T00:00:00.000Z": 92.5 },
      });
    }
  });

  test("a legacy linked series keeps its link, other variables are untouched", () => {
    const recipe = Recipe.from(linkedLegacy());
    expect(recipe.variables.map(variable => variable.type)).toEqual([RecipeDataTypes.Scalar, RecipeDataTypes.DataSeries]);
    expect(recipe.variables[1]).toMatchObject({ id: "parent", dataSeriesId: seriesId, pick: "whole", unit: "kg" });
  });

  test("serializing writes the current spelling and round-trips", () => {
    const recipe = Recipe.from(levelled());
    const serialized = recipe.serialize();

    expect(serialized).toContain(`"type":"data-series"`);
    expect(serialized).not.toContain(`"dataSeries"`);
    expect(isRecipe(serialized)).toBe(true);
    expect(Recipe.areRecipesEqual(Recipe.from(serialized), recipe)).toBe(true);
    // Same recipe as one written with the current spelling from the start
    expect(Recipe.areRecipesEqual(recipe, Recipe.from(withVariableType(RecipeDataTypes.DataSeries)))).toBe(true);
  });

  test("types that never existed are still rejected", () => {
    const invalidTypes: JSONValue[] = [
      "matrix", "vector", "DataSeries", "DATA_SERIES", "data_series", "dataseries", "dataSeries ", "",
      // Object.prototype members must not read as aliases
      "constructor", "toString", "__proto__", "hasOwnProperty",
      null, 1, ["dataSeries"], { type: "dataSeries" },
    ];
    for (const type of invalidTypes) {
      expect(() => Recipe.from(withVariableType(type)), `type ${JSON.stringify(type)}`).toThrow(RecipeError);
    }

    const withoutType = levelled() as { variables: Record<string, JSONValue>[] };
    delete withoutType.variables[0].type;
    expect(() => Recipe.from(withoutType as JSONValue)).toThrow(RecipeError);
  });

  test("a legacy spelling excuses nothing else: the variable still has to be valid", () => {
    const withoutPick = levelled() as { variables: Record<string, JSONValue>[] };
    delete withoutPick.variables[0].pick;
    expect(() => Recipe.from(withoutPick as JSONValue)).toThrow(RecipeError);

    // A scalar's fields under the data series spelling
    const mismatched = { ...(linkedLegacy() as object), variables: [{ id: "k", name: "Factor", type: "dataSeries", value: 2, unit: null }] };
    expect(() => Recipe.from(mismatched)).toThrow(RecipeError);
  });

  test("every alias is an old spelling of a current type", () => {
    const currentTypes: string[] = Object.values(RecipeDataTypes);
    expect(legacyRecipeDataTypes.size).toBeGreaterThan(0);
    for (const [legacy, current] of legacyRecipeDataTypes) {
      expect(currentTypes).toContain(current);
      expect(currentTypes).not.toContain(legacy);
    }
    expect(legacyRecipeDataTypes.get("dataSeries")).toBe(RecipeDataTypes.DataSeries);
  });
});

test.describe("withCurrentVariableTypes", () => {
  test("rewrites only the type of the affected variables, without mutating its input", () => {
    const stored = linkedLegacy();
    const snapshot = JSON.stringify(stored);
    const current = withCurrentVariableTypes(stored);

    expect(JSON.stringify(stored)).toBe(snapshot);
    expect(current).not.toBe(stored);
    expect(JSON.stringify(current)).toBe(snapshot.replace(`"type":"dataSeries"`, `"type":"data-series"`));
  });

  test("returns the very same value when there is nothing to rewrite", () => {
    const currentSpelling = withVariableType(RecipeDataTypes.DataSeries);
    const untouched: JSONValue[] = [
      currentSpelling,
      { name: "No variables", equation: "1", variables: [], meta: {} },
      { name: "Variables is not a list", variables: { type: "dataSeries" } },
      { variables: [null, "dataSeries", 3, ["dataSeries"], { name: "dataSeries" }, { type: 5 }] },
      // "dataSeries" anywhere but in a variable's type is just text
      { name: "dataSeries", type: "dataSeries", equation: "${dataSeries}", variables: [{ id: "dataSeries", name: "dataSeries", type: "scalar", value: 1 }], meta: { type: "dataSeries" } },
      "dataSeries", 7, null, [{ variables: [{ type: "dataSeries" }] }],
    ];
    for (const value of untouched) {
      expect(withCurrentVariableTypes(value)).toBe(value);
    }
  });
});

test.describe("legacy type rewrite plan", () => {
  const asAppStores = (recipe: JSONValue) => JSON.stringify(JSON.stringify(recipe));
  const currentRow = { id: "current", raw: asAppStores(JSON.parse(Recipe.from(levelled()).serialize()) as JSONValue) };

  test("plans the legacy rows in both storage shapes and nothing else", () => {
    const plan = planLegacyTypeRewrites([
      { id: "object", raw: levelledText },
      { id: "string", raw: asAppStores(linkedLegacy()) },
      currentRow,
    ]);

    expect(plan.scanned).toBe(3);
    expect(plan.stillInvalid).toEqual([]);
    expect(plan.otherwiseInvalid).toEqual([]);
    expect(plan.rewrites.map(rewrite => rewrite.id)).toEqual(["object", "string"]);

    const [object, string] = plan.rewrites;
    expect(object).toMatchObject({ before: levelledText, shape: StoredShape.Object, replaced: { dataSeries: 1 }, isManual: true });
    expect(string).toMatchObject({ shape: StoredShape.String, replaced: { dataSeries: 1 }, isManual: false });

    // Same JSON apart from the type, in the shape it was stored in
    expect(JSON.parse(object.after)).toEqual(withVariableType(RecipeDataTypes.DataSeries));
    const expectedLinked = linkedLegacy() as { variables: Record<string, JSONValue>[] };
    expectedLinked.variables[1].type = RecipeDataTypes.DataSeries;
    expect(JSON.parse(JSON.parse(string.after) as string)).toEqual(expectedLinked);

    // What the app reads back parses under the strict guard
    expect(isRecipe(JSON.parse(object.after) as JSONValue)).toBe(true);
    expect(isRecipe(JSON.parse(string.after) as JSONValue)).toBe(true);
  });

  test("counts every rewritten variable", () => {
    const twice = linkedLegacy() as { equation: string, variables: Record<string, JSONValue>[] };
    twice.variables.push({ ...twice.variables[1], id: "other", name: "Other" });
    const plan = planLegacyTypeRewrites([{ id: "twice", raw: JSON.stringify(twice) }]);
    expect(plan.rewrites[0].replaced).toEqual({ dataSeries: 2 });
  });

  test("is idempotent: the rewritten rows need no rewrite", () => {
    const first = planLegacyTypeRewrites([{ id: "object", raw: levelledText }, { id: "string", raw: asAppStores(linkedLegacy()) }]);
    const second = planLegacyTypeRewrites(first.rewrites.map(rewrite => ({ id: rewrite.id, raw: rewrite.after })));
    expect(second.rewrites).toEqual([]);
    expect(second.stillInvalid).toEqual([]);
    expect(second.otherwiseInvalid).toEqual([]);
  });

  test("rows that would not parse either way are listed, never rewritten", () => {
    const brokenLegacy = levelled() as { variables: Record<string, JSONValue>[] };
    delete brokenLegacy.variables[0].pick;

    const plan = planLegacyTypeRewrites([
      { id: "legacy-and-broken", raw: JSON.stringify(brokenLegacy) },
      { id: "unknown-type", raw: JSON.stringify(withVariableType("matrix")) },
      { id: "not-json", raw: "{name:" },
      { id: "string-of-nonsense", raw: JSON.stringify("{name:") },
      currentRow,
    ]);

    expect(plan.rewrites).toEqual([]);
    expect(plan.stillInvalid.map(row => row.id)).toEqual(["legacy-and-broken"]);
    expect(plan.otherwiseInvalid.map(row => row.id)).toEqual(["unknown-type", "not-json", "string-of-nonsense"]);
    for (const row of [...plan.stillInvalid, ...plan.otherwiseInvalid]) expect(row.reason).not.toBe("");

    const sql = legacyTypePlanToSql(plan);
    expect(sql).not.toContain("UPDATE");
    expect(legacyTypePlanToReport(plan)).toContain("legacy-and-broken");
  });

  test("the sql is one transaction of updates guarded on the text that was read, with literals escaped", () => {
    const awkward = levelled() as { name: string };
    awkward.name = "It's a \\ \"quoted\"\nname";
    const rows = [{ id: "object", raw: JSON.stringify(awkward) }, { id: "string", raw: asAppStores(awkward) }];
    const plan = planLegacyTypeRewrites(rows);
    const lines = legacyTypePlanToSql(plan).trimEnd().split("\n");

    expect(lines[0]).toMatch(/^-- /);
    expect(lines[1]).toBe("START TRANSACTION;");
    expect(lines[lines.length - 1]).toBe("COMMIT;");
    const updates = lines.slice(2, -1);
    expect(updates).toHaveLength(2);

    /** Reads a MariaDB string literal back the way the server does (default sql_mode) */
    const unquote = (literal: string) => literal.slice(1, -1).replace(/''|\\(.)/g, (match, escaped: string | undefined) => {
      if (match === "''") return "'";
      return escaped === "n" ? "\n" : escaped === "r" ? "\r" : escaped ?? "";
    });

    updates.forEach((update, index) => {
      const parts = /^UPDATE `Recipes` SET `recipe` = ('.*') WHERE `id` = ('.*') AND `recipe` = ('.*');$/.exec(update);
      expect(parts, update).not.toBeNull();
      const [, after, id, before] = parts ?? [];
      expect(unquote(id)).toBe(rows[index].id);
      expect(unquote(before)).toBe(rows[index].raw);
      expect(unquote(after)).toBe(plan.rewrites[index].after);
    });
  });

  test("the report counts by spelling, kind and storage shape", () => {
    const report = legacyTypePlanToReport(planLegacyTypeRewrites([
      { id: "object", raw: levelledText },
      { id: "string", raw: asAppStores(linkedLegacy()) },
      currentRow,
    ]));

    expect(report).toContain("3 recipes scanned");
    expect(report).toContain("2 store a legacy variable type, 2 to rewrite");
    expect(report).toContain(`"dataSeries": 2 variables in 2 recipes`);
    expect(report).toContain("manual (meta.isManual): 1, other: 1");
    expect(report).toContain("stored as a JSON object: 1, as a JSON string: 1");
  });
});
