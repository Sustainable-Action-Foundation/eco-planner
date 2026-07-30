/* eslint-disable no-template-curly-in-string */
// Shared helpers and types for the seed scripts.
// Pure random generators live at the top; DB-touching helpers (data series and
// recipe creation) live at the bottom. The philosophy of the app is that data
// series are derived through recipes, so every series is produced by one:
// manual entry uses an inline manual recipe, derived series use real ones.

import { prisma } from "@/lib/prisma";
import { Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import type { DateValues } from "@/types";
import { isISOIshDate } from "@/types/typeguards";
import type { Groups, Orgs, Users } from "@/lib/prisma/generated";
import { RandomTextSE } from "../randomText";
import { parseUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";

/*
 * Shared types passed between seed modules.
 */
export type SeededUsers = {
  admin: Users;
  anita: Users;
  anton: Users;
  /** All users, handy for picking a random author. */
  all: Users[];
  /** The org owning all seeded content; admin manages it, anita and anton are members. */
  org: Orgs;
  /** A group containing the two regular users, used to test grant-based sharing. */
  group: Groups;
};

/** A data series after it has been written to the DB, keeping its values in memory for further derivation. */
export type SeededSeries = {
  id: string;
  unit: string | null;
  dateValues: DateValues;
};

/** A goal after it has been written, keeping enough context to attach effects later. */
export type SeededGoal = {
  id: string;
  iterationId: string;
  series: SeededSeries;
};

/*
 * Pure random helpers
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomOf<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function getRandomDateInThePast(): Date {
  const roof = Date.now() - 1000 * 60; // 1 minute ago
  const floor = 1000 * 60; // Epoch-ish, but not the epoch itself
  return new Date(randomInt(floor, roof));
}

/** A created_at in the past and an updated_at that is usually equal to it, occasionally later. */
export function getRandomCreatedAtAndUpdatedAt(): { created_at: Date; updated_at: Date } {
  const created_at = getRandomDateInThePast();
  const updated_at = chance(0.75)
    ? created_at
    : new Date(created_at.getTime() + randomInt(0, 1000 * 60 * 60 * 24 * Math.floor(365.2425 * 5)));
  return { created_at, updated_at };
}

/** A grab bag of units, including empty/null/undefined to exercise the "missing" and "intentionally unitless" cases. */
export function getRandomUnit(): string | null | undefined {
  return randomOf(["CO2e", "capita", "kWh", "s", "m3", "kg", "ton", "Atemp", "", null, undefined]);
}

/** LEAP-style indicator parameter, e.g. "Key\Energiomvandling\Naturgas". */
export function randomIndicatorParameter(): string {
  const roots = ["Key", "Demand", "Transformation", "Resources"];
  const depth = randomInt(1, 4);
  const segments = new Array(depth).fill(null).map(() => RandomTextSlug());
  return [randomOf(roots), ...segments].join("\\");
}

/** A short slug of 1-2 words with whitespace removed, for indicator parameters. */
function RandomTextSlug(): string {
  return RandomTextSE.words(randomInt(1, 2)).replace(/\s+/g, "");
}

/** A coherent-ish series of yearly values from 2020 onward, with occasional gaps and trimmed ends. */
export function getRandomCoherentDateValues(): DateValues {
  const dateRange = new Array(30).fill(0).map((_, i) => 2020 + i);

  const dataPoints: DateValues = {};
  let startValue = randomInt(0, 10000);
  const deviation = randomInt(0, startValue) + Math.floor(startValue / 100);
  const inclination = chance(0.5) ? -1 : 1;

  // Small chance to trim empty years off the start and/or end.
  let years = dateRange;
  if (chance(0.2)) {
    const trimStart = randomInt(0, 9);
    const trimEnd = randomInt(0, 9);
    years = dateRange.slice(trimStart, dateRange.length - trimEnd);
  }

  for (const year of years) {
    if (chance(0.01)) continue; // Occasionally skip a year to create a gap

    const value = startValue + Math.random() * inclination * (randomInt(0, deviation) - randomInt(0, deviation) / 2);
    const timestamp = new Date(Date.UTC(year, 0, 1)).toISOString();
    if (!isISOIshDate(timestamp)) {
      throw new Error(`Generated timestamp ${timestamp} is not in a valid format.`);
    }
    dataPoints[timestamp] = value;
    startValue = value;
  }

  // Vanishingly unlikely, but guard against an empty series.
  if (Object.keys(dataPoints).length === 0) return getRandomCoherentDateValues();

  return dataPoints;
}

/*
 * DB helpers that produce comment payloads for nested writes.
 * The parent relation sets the foreign key implicitly, so no target id is needed.
 */
export function makeRandomComment(users: SeededUsers) {
  return {
    author_id: randomOf(users.all).id,
    comment_text: RandomTextSE.sentence(randomInt(1, 20)),
    ...getRandomCreatedAtAndUpdatedAt(),
  };
}

export function makeRandomComments(users: SeededUsers, count: number) {
  return new Array(count).fill(null).map(() => makeRandomComment(users));
}

/*
 * DB helpers for data series and recipes
 */

/** Coerce a possibly-undefined unit into the shape kept on a SeededSeries (undefined means the DB default ""). */
function normalizeUnit(unit: string | null | undefined): string | null {
  return unit === undefined ? "" : unit;
}

/**
 * Creates a data series with manually-entered values. Every series is produced by
 * a recipe; manual entry uses an inline manual recipe (`meta.isManual`), like the app.
 */
export async function createManualSeries(
  authorId: string,
  orgId: string,
  dateValues: DateValues,
  unit: string | null | undefined,
): Promise<SeededSeries> {
  const dbUnit = normalizeUnit(unit);
  const manualRecipe = Recipe.fromManualDateValues({ dateValues, unit: parseUnit(dbUnit) });
  const series = await prisma.dataSeries.create({
    data: {
      author: { connect: { id: authorId } },
      org: { connect: { id: orgId } },
      ...getRandomCreatedAtAndUpdatedAt(),
      ...(unit === undefined ? {} : { unit }),
      values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
      recipe_used: {
        create: {
          recipe: manualRecipe.serialize(),
          org: { connect: { id: orgId } },
        },
      },
    },
    select: { id: true },
  });
  return { id: series.id, unit: dbUnit, dateValues };
}

/** Creates a data series whose every value is the first value of the source, mimicking an "initial value" baseline. */
export async function createInitialBaseline(authorId: string, orgId: string, source: SeededSeries): Promise<SeededSeries> {
  const firstValue = Object.values(source.dateValues)[0] ?? 0;
  const flat: DateValues = Object.fromEntries(
    Object.keys(source.dateValues).map(key => [key, firstValue]),
  );
  return createManualSeries(authorId, orgId, flat, source.unit);
}

/**
 * Derives a new data series from a source series through a 1:1 recipe (equation `${x}`).
 * The recipe is stored, linked as the new series' `recipe_used`, and the source is
 * registered as one of the recipe's `source_data_series`.
 */
export async function deriveOneToOne(authorId: string, orgId: string, source: SeededSeries, name: string): Promise<SeededSeries> {
  const recipe = new Recipe({
    name,
    equation: "${källa}",
    variables: [
      {
        id: "källa",
        name: "källa",
        type: RecipeDataTypes.DataSeries,
        dataSeriesId: source.id,
        pick: VectorIndexPickerOptions.Default,
        value: null,
        unit: parseUnit(source.unit),
      },
    ],
  });
  return createDerivedSeries(authorId, orgId, recipe, source, { ...source.dateValues });
}

/**
 * Derives a new data series by scaling the source by a constant (equation `${källa} / ${skalär}`).
 * Fully computable offline, so the stored values stay consistent with the recipe.
 */
export async function deriveByScalar(
  authorId: string,
  orgId: string,
  source: SeededSeries,
  scalar: number,
  name: string,
): Promise<SeededSeries> {
  const recipe = new Recipe({
    name,
    equation: "${källa} / ${skalär}",
    variables: [
      {
        id: "källa",
        name: "källa",
        type: RecipeDataTypes.DataSeries,
        dataSeriesId: source.id,
        pick: VectorIndexPickerOptions.Default,
        value: null,
        unit: parseUnit(source.unit),
      },
      {
        id: "skalär",
        name: "skalär",
        type: RecipeDataTypes.Scalar,
        value: scalar,
        unit: UnitFlags.Unitless,
      },
    ],
  });
  const scaled: DateValues = Object.fromEntries(
    Object.entries(source.dateValues).map(([key, value]) => [key, value / scalar]),
  );
  return createDerivedSeries(authorId, orgId, recipe, source, scaled);
}

/** Shared tail of the derive* helpers: persist the recipe, then the derived series linked back to it. */
async function createDerivedSeries(
  authorId: string,
  orgId: string,
  recipe: Recipe,
  source: SeededSeries,
  values: DateValues,
): Promise<SeededSeries> {
  const recipeRow = await prisma.recipes.create({
    data: {
      recipe: recipe.serialize(),
      org: { connect: { id: orgId } },
      source_data_series: { connect: { id: source.id } },
    },
    select: { id: true },
  });
  const series = await prisma.dataSeries.create({
    data: {
      author: { connect: { id: authorId } },
      org: { connect: { id: orgId } },
      ...getRandomCreatedAtAndUpdatedAt(),
      ...(source.unit === null ? { unit: UnitFlags.Unitless } : { unit: source.unit }),
      values: { createMany: { data: dateValuesToDBDateRecord(values) } },
      recipe_used: { connect: { id: recipeRow.id } },
    },
    select: { id: true },
  });
  return { id: series.id, unit: source.unit, dateValues: values };
}

/**
 * Creates a pair of suggestion recipes (1:1 and scale-by-constant) that source the
 * given series, so goals inheriting from this one have something to pick.
 * Returns the created recipe ids for connecting as `recipe_suggestions`.
 */
export async function createSuggestionRecipes(orgId: string, source: SeededSeries): Promise<string[]> {
  const oneToOne = new Recipe({
    name: "Ärv 1:1",
    equation: "${källa}",
    meta: { isSuggestedRecipe: true },
    variables: [
      {
        id: "källa",
        name: "källa",
        type: RecipeDataTypes.DataSeries,
        dataSeriesId: source.id,
        pick: VectorIndexPickerOptions.Default,
        value: null,
        unit: parseUnit(source.unit),
      },
    ],
  });
  const byScalar = new Recipe({
    name: "Skala utifrån fast värde",
    equation: "${källa} / ${skalär}",
    meta: { isSuggestedRecipe: true },
    variables: [
      {
        id: "källa",
        name: "källa",
        type: RecipeDataTypes.DataSeries,
        dataSeriesId: source.id,
        pick: VectorIndexPickerOptions.Default,
        value: null,
        unit: parseUnit(source.unit),
      },
      { id: "skalär", name: "skalär", type: RecipeDataTypes.Scalar, value: 1 + Math.random(), unit: UnitFlags.Unitless },
    ],
  });

  const created = await prisma.$transaction([oneToOne, byScalar].map(recipe =>
    prisma.recipes.create({
      data: {
        recipe: recipe.serialize(),
        org: { connect: { id: orgId } },
        source_data_series: { connect: { id: source.id } },
      },
      select: { id: true },
    }),
  ));
  return created.map(recipe => recipe.id);
}

// Re-exported so seed modules can generate Swedish-ish filler without importing the path directly.
export { RandomTextSE };
