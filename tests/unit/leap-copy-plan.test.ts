import { expect, test } from "playwright/test";
import { copyCandidates, CopyMethod, ExternalRegistry, findLocalStatistic, materializeRecipe, planCopy, seriesGetter } from "../../scripts/lib/leapCopyPlan";
import type { NationalGoalSeed } from "../../scripts/lib/leapCopyPlan";
import { curatedKey, requiredStatistics, snapshotDateValues, toSnapshotValues } from "../../scripts/lib/statisticsSnapshot";
import type { StatisticsSnapshot } from "../../scripts/lib/statisticsSnapshot";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { GeoAreaType, GoalListing } from "../../src/lib/prisma/generated";
import type { GeoAreaRef } from "../../src/types";
import type { TFunction } from "i18next";

/*
 * The seed's copy planner against a hand-made statistics snapshot: which
 * method a national goal gets in an area, how externals are materialized once
 * per selection, and that the copies evaluate to what the methods say.
 */

const t = ((key: string, options?: Record<string, unknown>) => options ? `${key} ${JSON.stringify(options)}` : key) as TFunction;
const boden: GeoAreaRef = { code: "2582", name: "Boden", type: GeoAreaType.MUNICIPALITY };
const K = "Key\\";

const years = (from: number, to: number, value: (year: number) => number) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [String(from + i), value(from + i)]));

function goal(indicatorParameter: string, unit: string | null, value: (year: number) => number): NationalGoalSeed {
  const dataSeriesId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    name: null,
    description: null,
    indicatorParameter,
    listing: GoalListing.LISTED,
    unit,
    dataSeriesId,
    dateValues: snapshotDateValues({ dataset: "SCB", tableId: "goal", selection: [], values: years(2022, 2030, value) }),
  };
}

const populationKeyLocal = '["SCB","TAB628",[{"variableCode":"ContentsCode","valueCodes":["BE0101U2"]},{"variableCode":"Kon","valueCodes":["1+2"]},{"variableCode":"Region","valueCodes":["2582"]}]]';
const populationKeyNation = '["SCB","TAB628",[{"variableCode":"ContentsCode","valueCodes":["BE0101U2"]},{"variableCode":"Kon","valueCodes":["1+2"]},{"variableCode":"Region","valueCodes":["00"]}]]';
const forecastKeyLocal = '["SCB","TAB6299",[{"variableCode":"ContentsCode","valueCodes":["000006MS"]},{"variableCode":"Region","valueCodes":["2582"]}]]';
const forecastKeyNation = '["SCB","TAB6579",[{"variableCode":"ContentsCode","valueCodes":["000007YG"]}]]';
const electricCarsLocal = '["Trafa","t10026",[{"variableCode":"drivmedel","valueCodes":["103"]},{"variableCode":"metric","valueCodes":["itrfslut"]},{"variableCode":"regkom","valueCodes":["2582"]},{"variableCode":"reglan","valueCodes":["25"]}]]';
const electricCarsNation = '["Trafa","t10026",[{"variableCode":"drivmedel","valueCodes":["103"]},{"variableCode":"metric","valueCodes":["itrfslut"]}]]';

const snapshot: StatisticsSnapshot = {
  fetchedAt: "2026-09-15T00:00:00.000Z",
  errors: {},
  series: {
    // Boden is a hundredth of the nation, in people and in forecast
    [populationKeyLocal]: { dataset: "SCB", tableId: "TAB628", selection: [], values: years(2015, 2024, () => 100_000) },
    [populationKeyNation]: { dataset: "SCB", tableId: "TAB628", selection: [], values: years(2015, 2024, () => 10_000_000) },
    [forecastKeyLocal]: { dataset: "SCB", tableId: "TAB6299", selection: [], values: years(2022, 2030, () => 100_000) },
    [forecastKeyNation]: { dataset: "SCB", tableId: "TAB6579", selection: [], values: years(2022, 2030, () => 10_000_000) },
    // Electric cars: 500 locally in 2024, with a national count for the ratio rule
    [electricCarsLocal]: { dataset: "Trafa", tableId: "t10026", selection: [], values: years(2020, 2024, year => 100 * (year - 2019)) },
    [electricCarsNation]: { dataset: "Trafa", tableId: "t10026", selection: [], values: years(2020, 2024, year => 100_000 * (year - 2019)) },
    [curatedKey("cars-by-fuel", "electric", "2582")]: { dataset: "Trafa", tableId: "t10026", selection: [{ variableCode: "drivmedel", valueCodes: ["103"] }], values: years(2020, 2024, year => 100 * (year - 2019)) },
  },
};

test.describe("LEAP copy planning", () => {
  test("a row the catalog measures locally follows the local statistic, with the LEAP methods behind it", () => {
    const electric = goal(`${K}Landtransporter\\Personbilar\\Elbilar\\Antal bilar`, null, year => 1_000_000 * (year - 2021));
    const local = findLocalStatistic(t, snapshot, electric.indicatorParameter, boden);
    expect(local?.key).toBe(curatedKey("cars-by-fuel", "electric", "2582"));
    const methods = copyCandidates(t, electric, boden, local).map(candidate => candidate.method);
    expect(methods).toEqual([CopyMethod.Local, CopyMethod.LeapYearly, CopyMethod.LeapLatest, CopyMethod.Population]);
  });

  test("a resident-driven total is scaled by population, per year first", () => {
    const heating = goal(`${K}Befolkning\\Befolkning`, "personer", year => 10_000_000 + 10_000 * (year - 2022));
    const methods = copyCandidates(t, heating, boden, null).map(candidate => candidate.method);
    expect(methods).toEqual([CopyMethod.LeapYearly, CopyMethod.LeapLatest, CopyMethod.Population]);
  });

  test("a point source is zeroed rather than copied", () => {
    const nuclear = goal(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för elproduktion\\Kärnbränsle`, "TWh", () => 138);
    const methods = copyCandidates(t, nuclear, boden, null).map(candidate => candidate.method);
    expect(methods[0]).toBe(CopyMethod.Zero);
    expect(methods).toContain(CopyMethod.Copy);
  });

  test("a row without a rule falls back to the population ratio", () => {
    const other = goal(`${K}Luftfart\\Något helt annat`, "TWh", () => 1);
    const methods = copyCandidates(t, other, boden, null).map(candidate => candidate.method);
    expect(methods).toEqual([CopyMethod.Population]);
  });

  test("externals are materialized once per selection and the recipe reads the materialized series", () => {
    const registry = new ExternalRegistry(snapshot);
    const population = goal(`${K}Befolkning\\Befolkning`, null, () => 1);
    const [yearly, latest] = copyCandidates(t, population, boden, null);
    const first = materializeRecipe(yearly.recipe, registry);
    const second = materializeRecipe(latest.recipe, registry);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // The per-year method reads the forecasts, the latest-value one the year-end counts: four series in all, none twice
    expect(registry.all()).toHaveLength(4);
    const materialized = Recipe.from(first?.recipe ?? "").variables;
    expect(materialized.every(variable => variable.type !== RecipeDataTypes.External)).toBe(true);
    expect(materialized.filter(variable => variable.type === RecipeDataTypes.DataSeries && variable.externalSource)).toHaveLength(2);
    expect(first?.sourceIds).toHaveLength(3);
  });

  test("a copy evaluates to the national goal times the local share", async () => {
    const registry = new ExternalRegistry(snapshot);
    const population = goal(`${K}Befolkning\\Befolkning`, "personer", () => 10_000_000);
    const national = new Map([[population.dataSeriesId, population]]);
    const { planned, failures } = await planCopy(t, population, boden, snapshot, registry, seriesGetter(national, registry));
    expect(failures).toEqual([]);
    expect(planned?.method).toBe(CopyMethod.LeapYearly);
    const values = Object.values(planned?.series.dateValues ?? {});
    expect(values).toHaveLength(9);
    for (const value of values) expect(value).toBeCloseTo(100_000, 3);
    expect(planned?.series.unit).toBe("personer");
  });

  test("a copy following the local statistic starts from the local level and keeps the statistic as history", async () => {
    const registry = new ExternalRegistry(snapshot);
    const electric = goal(`${K}Landtransporter\\Personbilar\\Elbilar\\Antal bilar`, null, year => 1_000_000 * (year - 2021));
    const national = new Map([[electric.dataSeriesId, electric]]);
    const { planned } = await planCopy(t, electric, boden, snapshot, registry, seriesGetter(national, registry));
    expect(planned?.method).toBe(CopyMethod.Local);
    // Anchored in 2024: 500 locally, 3 000 000 nationally, so the copy is the goal / 6000
    const dateValues = planned?.series.dateValues ?? {};
    expect(dateValues["2024-01-01T00:00:00.000Z"]).toBeCloseTo(500, 6);
    expect(dateValues["2030-01-01T00:00:00.000Z"]).toBeCloseTo(1500, 6);
    expect(planned?.historical?.key).toBe(curatedKey("cars-by-fuel", "electric", "2582"));
  });

  test("a missing statistic moves the copy on to the next method", async () => {
    const withoutForecast: StatisticsSnapshot = { ...snapshot, series: { ...snapshot.series, [forecastKeyLocal]: null } };
    const registry = new ExternalRegistry(withoutForecast);
    const population = goal(`${K}Befolkning\\Befolkning`, "personer", () => 10_000_000);
    const national = new Map([[population.dataSeriesId, population]]);
    const { planned, failures } = await planCopy(t, population, boden, withoutForecast, registry, seriesGetter(national, registry));
    expect(failures).toHaveLength(1);
    expect(planned?.method).toBe(CopyMethod.LeapLatest);
    for (const value of Object.values(planned?.series.dateValues ?? {})) expect(value).toBeCloseTo(100_000, 3);
  });

  test("the required statistics cover both sides of every method plus the local anchors and national history", () => {
    const requests = requiredStatistics(t, [`${K}Landtransporter\\Personbilar\\Elbilar\\Antal bilar`, `${K}Befolkning\\Befolkning`], [boden]);
    const keys = requests.map(request => request.key);
    expect(keys).toContain(electricCarsLocal);
    expect(keys).toContain(electricCarsNation);
    expect(keys).toContain(forecastKeyLocal);
    expect(keys).toContain(forecastKeyNation);
    expect(keys).toContain(populationKeyLocal);
    expect(keys).toContain(populationKeyNation);
    expect(keys).toContain(curatedKey("cars-by-fuel", "electric", "2582"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("snapshot values round-trip through the app's date values", () => {
    const values = years(2020, 2022, year => year);
    expect(toSnapshotValues(snapshotDateValues({ dataset: "SCB", tableId: "x", selection: [], values }))).toEqual(values);
  });
});
