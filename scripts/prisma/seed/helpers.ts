/* eslint-disable no-template-curly-in-string */
// Shared helpers and types for the seed scripts.
// Pure random generators live at the top; DB-touching helpers (data series and
// recipe creation) live at the bottom. The philosophy of the app is that data
// series are derived through recipes, so the derive* helpers below are the main
// way seeded data series come into existence.

import { prisma } from "@/lib/prisma";
import { Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import type { DateValues } from "@/types";
import { isISOIshDate } from "@/types/typeguards";
import type { User, UserGroup } from "@/lib/prisma/generated";
import { RandomTextSE } from "../randomText";

/*
 * Shared types passed between seed modules.
 */
export type SeededUsers = {
  admin: User;
  anita: User;
  anton: User;
  /** All users, handy for picking a random author. */
  all: User[];
  /** A user group containing the two regular users, used to test group sharing. */
  group: UserGroup;
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
  roadmapId: string;
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

/** A createdAt in the past and an updatedAt that is usually equal to it, occasionally later. */
export function getRandomCreatedAtAndUpdatedAt(): { createdAt: Date; updatedAt: Date } {
  const createdAt = getRandomDateInThePast();
  const updatedAt = chance(0.75)
    ? createdAt
    : new Date(createdAt.getTime() + randomInt(0, 1000 * 60 * 60 * 24 * Math.floor(365.2425 * 5)));
  return { createdAt, updatedAt };
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
 * DB helpers that produce comment/link payloads for nested writes.
 * The parent relation sets the foreign key implicitly, so no target id is needed.
 */
export function makeRandomComment(users: SeededUsers) {
  const { createdAt, updatedAt } = getRandomCreatedAtAndUpdatedAt();
  return {
    authorId: randomOf(users.all).id,
    commentText: RandomTextSE.sentence(randomInt(1, 20)),
    createdAt,
    updatedAt,
  };
}

export function makeRandomComments(users: SeededUsers, count: number) {
  return new Array(count).fill(null).map(() => makeRandomComment(users));
}

export function makeRandomLink() {
  return {
    url: randomOf([
      "https://sustainable-action.org/",
      "https://www.scb.se/",
      "https://www.naturvardsverket.se/",
      "https://youtu.be/dQw4w9WgXcQ",
    ]),
    description: chance(0.6) ? RandomTextSE.sentence(randomInt(2, 5)) : undefined,
  };
}

export function makeRandomLinks(count: number) {
  return new Array(count).fill(null).map(() => makeRandomLink());
}

/*
 * DB helpers for data series and recipes
 */

/** Coerce a possibly-undefined unit into the shape kept on a SeededSeries (undefined means the DB default ""). */
function normalizeUnit(unit: string | null | undefined): string | null {
  return unit === undefined ? "" : unit;
}

/**
 * Creates a "base" data series with manually-entered values and no recipe.
 * Base/manually-entered data legitimately has no recipe; derived series (below) do.
 */
export async function createManualSeries(
  authorId: string,
  dateValues: DateValues,
  unit: string | null | undefined,
): Promise<SeededSeries> {
  const { createdAt, updatedAt } = getRandomCreatedAtAndUpdatedAt();
  const series = await prisma.dataSeries.create({
    data: {
      authorId,
      createdAt,
      updatedAt,
      ...(unit === undefined ? {} : { unit }),
      values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
    },
    select: { id: true },
  });
  return { id: series.id, unit: normalizeUnit(unit), dateValues };
}

/** Creates a data series whose every value is the first value of the source, mimicking an "initial value" baseline. */
export async function createInitialBaseline(authorId: string, source: SeededSeries): Promise<SeededSeries> {
  const firstValue = Object.values(source.dateValues)[0] ?? 0;
  const flat: DateValues = Object.fromEntries(
    Object.keys(source.dateValues).map(key => [key, firstValue]),
  );
  return createManualSeries(authorId, flat, source.unit);
}

/**
 * Derives a new data series from a source series through a 1:1 recipe (equation `${x}`).
 * The recipe is stored, linked as the new series' `recipeUsed`, and the source is
 * registered as one of the recipe's `sourceDataSeries`.
 */
export async function deriveOneToOne(authorId: string, source: SeededSeries, name: string): Promise<SeededSeries> {
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
        unit: source.unit ?? undefined,
      },
    ],
  });
  return createDerivedSeries(authorId, recipe, source, { ...source.dateValues });
}

/**
 * Derives a new data series by scaling the source by a constant (equation `${källa} / ${skalär}`).
 * Fully computable offline, so the stored values stay consistent with the recipe.
 */
export async function deriveByScalar(
  authorId: string,
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
        unit: source.unit ?? undefined,
      },
      {
        id: "skalär",
        name: "skalär",
        type: RecipeDataTypes.Scalar,
        value: scalar,
        unit: null,
      },
    ],
  });
  const scaled: DateValues = Object.fromEntries(
    Object.entries(source.dateValues).map(([key, value]) => [key, value / scalar]),
  );
  return createDerivedSeries(authorId, recipe, source, scaled);
}

/** Shared tail of the derive* helpers: persist the recipe, then the derived series linked back to it. */
async function createDerivedSeries(
  authorId: string,
  recipe: Recipe,
  source: SeededSeries,
  values: DateValues,
): Promise<SeededSeries> {
  const recipeRow = await prisma.recipe.create({
    data: {
      recipe: recipe.serialize(),
      sourceDataSeries: { connect: { id: source.id } },
    },
    select: { id: true },
  });
  const { createdAt, updatedAt } = getRandomCreatedAtAndUpdatedAt();
  const series = await prisma.dataSeries.create({
    data: {
      author: { connect: { id: authorId } },
      createdAt,
      updatedAt,
      ...(source.unit === null ? { unit: null } : { unit: source.unit }),
      values: { createMany: { data: dateValuesToDBDateRecord(values) } },
      recipeUsed: { connect: { id: recipeRow.id } },
    },
    select: { id: true },
  });
  return { id: series.id, unit: source.unit, dateValues: values };
}

/**
 * Creates a pair of suggestion recipes (1:1 and scale-by-constant) that source the
 * given series, so goals inheriting from this one have something to pick.
 * Returns the created recipe ids for connecting as `recipeSuggestions`.
 */
export async function createSuggestionRecipes(source: SeededSeries): Promise<string[]> {
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
        unit: source.unit ?? undefined,
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
        unit: source.unit ?? undefined,
      },
      { id: "skalär", name: "skalär", type: RecipeDataTypes.Scalar, value: 1 + Math.random(), unit: null },
    ],
  });

  const created = await prisma.$transaction([oneToOne, byScalar].map(recipe =>
    prisma.recipe.create({
      data: { recipe: recipe.serialize(), sourceDataSeries: { connect: { id: source.id } } },
      select: { id: true },
    }),
  ));
  return created.map(recipe => recipe.id);
}

// Re-exported so seed modules can generate Swedish-ish filler without importing the path directly.
export { RandomTextSE };
