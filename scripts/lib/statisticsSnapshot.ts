/**
 * The statistics the seed needs, frozen in a file. The seed materializes external
 * variables (SCB, Energimyndigheten, Trafa) exactly like the goal API does, but it
 * runs where those APIs are out of reach (the staging seed container sits on an
 * internal-only network) and must give the same result every time, so the series
 * are fetched once by scripts/prisma/refresh-seed-statistics.ts into
 * scripts/prisma/seed/data/statistics-snapshot.json and read from there.
 *
 * Series are keyed by their selection (`externalSelectionKey`), the same key the
 * app uses to tell selections apart. Curated catalog series whose region can only
 * be resolved against table metadata (label-prefixed regions) are keyed by entry,
 * series and area instead, with the resolved selection stored alongside.
 */

import fs from "node:fs";
import path from "node:path";
import { externalSelectionKey } from "@/functions/recipe/extractors";
import { Recipe } from "@/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { DefaultSuggestedRecipeId, getDefaultSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { getLeapSuggestedRecipes } from "@/components/recipe/suggestions/leapSuggestedRecipes";
import { getCuratedHistoricalCatalog, getNationalGoalMappings } from "@/lib/curatedHistoricalData";
import { getLeapNationalSource } from "@/lib/leapNationalSeries";
import { UnitFlags } from "@/types/enums";
import { isISOIshDate } from "@/types/typeguards";
import type { SuggestedRecipeContext } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import type { CuratedSource } from "@/lib/curatedHistoricalData";
import type { RecipeVariable } from "@/functions/recipe/types";
import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import type { DateValues, GeoAreaRef, PrefilledSeries } from "@/types";
import type { TFunction } from "i18next";

export const SNAPSHOT_PATH = path.join("scripts", "prisma", "seed", "data", "statistics-snapshot.json");

export type SnapshotSeries = {
  dataset: DatasetKeys;
  tableId: string;
  /** The selection as queried, region included */
  selection: ApiSelectionItem[];
  /** Year → value */
  values: Record<string, number>;
};

export type StatisticsSnapshot = {
  fetchedAt: string;
  /** Null for a series the refresh could not fetch (see `errors`) */
  series: Record<string, SnapshotSeries | null>;
  errors: Record<string, string>;
};

/** One series the seed will look up, and how to fetch it. */
export type SnapshotRequest =
  | { kind: "resolved", key: string, dataset: DatasetKeys, tableId: string, selection: ApiSelectionItem[] }
  | { kind: "curated", key: string, source: CuratedSource, area: GeoAreaRef };

export const NATION: GeoAreaRef = { code: "00", name: "Riket", type: "NATION" };

export function curatedKey(entryKey: string, seriesKey: string, areaCode: string): string {
  return `curated:${entryKey}/${seriesKey}@${areaCode}`;
}

/** The snapshot's year map as the app's date values. */
export function snapshotDateValues(series: SnapshotSeries): DateValues {
  const dateValues: DateValues = {};
  for (const [year, value] of Object.entries(series.values)) {
    const date = `${year}-01-01T00:00:00.000Z`;
    if (!isISOIshDate(date)) throw new Error(`Bad year "${year}" in the statistics snapshot`);
    dateValues[date] = value;
  }
  return dateValues;
}

/** The app's date values as the snapshot's year map. */
export function toSnapshotValues(dateValues: DateValues): Record<string, number> {
  return Object.fromEntries(Object.entries(dateValues).map(([date, value]) => [String(new Date(date).getUTCFullYear()), value]));
}

export function loadSnapshot(): StatisticsSnapshot | null {
  const file = path.join(process.cwd(), SNAPSHOT_PATH);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as StatisticsSnapshot;
}

export function saveSnapshot(snapshot: StatisticsSnapshot): void {
  const file = path.join(process.cwd(), SNAPSHOT_PATH);
  const sorted: StatisticsSnapshot = {
    fetchedAt: snapshot.fetchedAt,
    series: Object.fromEntries(Object.entries(snapshot.series).sort(([a], [b]) => a.localeCompare(b))),
    errors: Object.fromEntries(Object.entries(snapshot.errors).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(file, JSON.stringify(sorted) + "\n");
}

/** A parent that only has to exist for the suggestion builders to run. */
const placeholderParent: PrefilledSeries = {
  name: "placeholder",
  unit: null,
  variable: { id: "00000000-0000-4000-8000-000000000001", name: "placeholder", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: "00000000-0000-4000-8000-000000000002", value: null },
};

/**
 * Every series the seed can ask for when it copies the national goals with the
 * given indicator parameters into the given areas: the LEAP scaling methods'
 * externals (local and national sides), the population fallback, the curated
 * series that give a goal a local anchor, and the national statistics that fill
 * the national goals' history. Deduplicated by key.
 */
export function requiredStatistics(t: TFunction, indicatorParameters: string[], areas: GeoAreaRef[]): SnapshotRequest[] {
  const requests = new Map<string, SnapshotRequest>();
  const addExternals = (variables: RecipeVariable[]) => {
    for (const variable of variables) {
      if (variable.type !== RecipeDataTypes.External || !variable.dataset || !variable.tableId) continue;
      const key = externalSelectionKey(variable.dataset, variable.tableId, variable.selection);
      if (!requests.has(key)) requests.set(key, { kind: "resolved", key, dataset: variable.dataset, tableId: variable.tableId, selection: variable.selection });
    }
  };
  const mappings = getNationalGoalMappings().filter(mapping => indicatorParameters.includes(mapping.indicatorParameter));

  for (const area of areas) {
    const geo = { source: NATION, target: area };
    for (const indicatorParameter of indicatorParameters) {
      const context: SuggestedRecipeContext = { parentSeries: placeholderParent, indicatorParameter, nationalScenario: true, geo };
      for (const suggestion of getLeapSuggestedRecipes(t, context)) addExternals(Recipe.from(suggestion.recipe).variables);
    }
    const population = getDefaultSuggestedRecipes(t, { parentSeries: placeholderParent, geo }).find(recipe => recipe.id === DefaultSuggestedRecipeId.Population);
    if (population) addExternals(Recipe.from(population.recipe).variables);

    const catalog = getCuratedHistoricalCatalog(t, area.name);
    for (const mapping of mappings) {
      for (const candidate of mapping.series) {
        const entry = catalog.entries.find(entry => entry.key === candidate.entryKey);
        const series = entry?.series.find(series => series.key === candidate.seriesKey);
        const source = series?.sources[area.type];
        if (!entry || !series || !source) continue;
        const key = curatedKey(entry.key, series.key, area.code);
        if (!requests.has(key)) requests.set(key, { kind: "curated", key, source, area });
      }
    }
  }

  for (const indicatorParameter of indicatorParameters) {
    const source = getLeapNationalSource(indicatorParameter);
    if (!source) continue;
    const key = externalSelectionKey(source.dataset, source.tableId, source.selection);
    if (!requests.has(key)) requests.set(key, { kind: "resolved", key, dataset: source.dataset, tableId: source.tableId, selection: source.selection });
  }

  return [...requests.values()];
}
