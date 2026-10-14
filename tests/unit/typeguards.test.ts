import { expect, test } from "playwright/test";

import {
  isDataSeriesVariable,
  isExternalSelection,
  isExternalVariable,
  isRecipe,
  isScalarVariable,
  isStringifiedExternalSelection,
} from "../../src/functions/recipe/types/typeguards";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { AccessLevel, GoalListing, Sharing } from "../../src/lib/prisma/generated";
import type { JSONValue } from "../../src/types";
import { GoalDataTarget } from "../../src/types/enums";
import {
  isAccessControlInput,
  isDateValues,
  isDateValuesWithUnit,
  isGoalCreate,
  isGoalUpdate,
  isISOIshDate,
  isRoadmapCreate,
  isRoadmapUpdate,
  isUnit,
} from "../../src/types/typeguards";

/*
 * The typeguards gate every API body. One accept and a few rejects per guard,
 * plus every GoalDataTarget variant for the goal guards. The guards log their
 * reasons through console.debug/warn; silenced here to keep the output clean.
 */

const originalDebug = console.debug;
const originalWarn = console.warn;
test.beforeAll(() => {
  console.debug = () => undefined;
  console.warn = () => undefined;
});
test.afterAll(() => {
  console.debug = originalDebug;
  console.warn = originalWarn;
});

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const series = () => ({ dateValues: { "2020-01-01T00:00:00.000Z": 1, "2030-01-01T00:00:00Z": 2 }, unit: "kg" });

test.describe("primitive guards", () => {
  test("isISOIshDate accepts midnight UTC with or without milliseconds", () => {
    expect(isISOIshDate("2020-01-01T00:00:00.000Z")).toBe(true);
    expect(isISOIshDate("2020-01-01T00:00:00Z")).toBe(true);
    for (const bad of ["2020-01-01", "2020-01-01T12:00:00.000Z", "2020-01-01T00:00:00.000+00:00", "2020-1-1T00:00:00.000Z", " 2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.0Z"]) {
      expect(isISOIshDate(bad), bad).toBe(false);
    }
  });

  test("isDateValues wants ISO-ish keys and numeric values", () => {
    expect(isDateValues({})).toBe(true);
    expect(isDateValues(series().dateValues)).toBe(true);
    expect(isDateValues({ "2020-01-01T00:00:00.000Z": "1" })).toBe(false);
    expect(isDateValues({ "2020": 1 })).toBe(false);
    expect(isDateValues([1])).toBe(false);
    expect(isDateValues(null)).toBe(false);
  });

  test("isUnit is any non-blank string (flags included), never the db convention", () => {
    expect(isUnit("kg")).toBe(true);
    expect(isUnit("UNITLESS")).toBe(true);
    expect(isUnit("MISSING_UNIT")).toBe(true);
    expect(isUnit("")).toBe(false);
    expect(isUnit("  ")).toBe(false);
    expect(isUnit(null)).toBe(false);
    expect(isUnit(undefined)).toBe(false);
    expect(isUnit(5)).toBe(false);
  });

  test("isDateValuesWithUnit", () => {
    expect(isDateValuesWithUnit(series())).toBe(true);
    expect(isDateValuesWithUnit({ dateValues: series().dateValues })).toBe(false);
    expect(isDateValuesWithUnit({ dateValues: { "2020": 1 }, unit: "kg" })).toBe(false);
    expect(isDateValuesWithUnit({ dateValues: null, unit: "kg" })).toBe(false);
  });
});

test.describe("isAccessControlInput", () => {
  test("accepts undefined, bare sharing, and grants with known levels", () => {
    expect(isAccessControlInput(undefined)).toBe(true);
    expect(isAccessControlInput({ sharing: Sharing.ORG, grants: undefined })).toBe(true);
    expect(isAccessControlInput({ sharing: undefined, grants: null })).toBe(true);
    expect(isAccessControlInput({ sharing: Sharing.GROUPS, grants: [{ groupId: "g", accessLevel: AccessLevel.RW }, { groupId: "h", accessLevel: AccessLevel.RO }] })).toBe(true);
  });

  test("rejects null, unknown sharing and malformed grants", () => {
    expect(isAccessControlInput(null)).toBe(false);
    expect(isAccessControlInput({ sharing: "EVERYONE" })).toBe(false);
    expect(isAccessControlInput({ sharing: Sharing.ORG, grants: [{ groupId: "g", accessLevel: "ADMIN" }] })).toBe(false);
    expect(isAccessControlInput({ sharing: Sharing.ORG, grants: [{ groupId: 1, accessLevel: AccessLevel.RO }] })).toBe(false);
    expect(isAccessControlInput({ sharing: Sharing.ORG, grants: { groupId: "g", accessLevel: AccessLevel.RO } })).toBe(false);
    expect(isAccessControlInput("ORG")).toBe(false);
  });
});

test.describe("roadmap guards", () => {
  test("isRoadmapCreate accepts the required trio and optional fields", () => {
    expect(isRoadmapCreate({ name: "R", description: "d", orgId: "o" })).toBe(true);
    expect(isRoadmapCreate({ name: "R", description: "d", orgId: "o", type: "NATIONAL", actor: null, geoAreaCode: "0580", access: { sharing: "PUBLIC" }, parentRoadmapId: null })).toBe(true);
  });

  test("isRoadmapCreate rejects a missing org, an id, or a bad access block", () => {
    expect(isRoadmapCreate({ name: "R", description: "d" })).toBe(false);
    expect(isRoadmapCreate({ id: "x", name: "R", description: "d", orgId: "o" })).toBe(false);
    expect(isRoadmapCreate({ name: "R", description: "d", orgId: "o", access: null })).toBe(false);
    expect(isRoadmapCreate({ name: "R", description: 1, orgId: "o" })).toBe(false);
    expect(isRoadmapCreate([])).toBe(false);
    expect(isRoadmapCreate("roadmap")).toBe(false);
  });

  test("isRoadmapUpdate needs id and timestamp and refuses an org change", () => {
    expect(isRoadmapUpdate({ id: "x", timestamp: 1 })).toBe(true);
    expect(isRoadmapUpdate({ id: "x", timestamp: 1, name: "N", description: undefined, parentRoadmapId: "p" })).toBe(true);
    expect(isRoadmapUpdate({ id: "x" })).toBe(false);
    expect(isRoadmapUpdate({ id: "x", timestamp: "1" })).toBe(false);
    expect(isRoadmapUpdate({ id: "x", timestamp: 1, orgId: "o" })).toBe(false);
    expect(isRoadmapUpdate({ timestamp: 1, name: "N" })).toBe(false);
    expect(isRoadmapUpdate(null)).toBe(false);
  });
});

test.describe("goal guards: every GoalDataTarget variant", () => {
  const section = (target: GoalDataTarget, extra: Record<string, unknown> = {}) => ({ target, goalId: "g", timestamp: 1, ...extra });

  test("Full create accepts the minimum and the kitchen sink", () => {
    expect(isGoalCreate({ target: GoalDataTarget.Full, iterationId: "it", indicatorParameter: "Key\\A", dataSeries: series() })).toBe(true);
    expect(isGoalCreate({
      target: GoalDataTarget.Full, iterationId: "it", indicatorParameter: "Key\\A", dataSeries: series(),
      name: "n", description: null, listing: GoalListing.FEATURED, rawTags: ["a"], copiedFromGoalId: null,
      dataSeriesRecipe: "{}", dataSeriesRecipeId: null, baseline: series(), baselineRecipe: null,
      historical: null, historicalRecipe: "{}", recipeSuggestions: ["{}"],
    })).toBe(true);
  });

  test("Full create parses JSON-encoded series in place", () => {
    const body: Record<string, unknown> = { target: GoalDataTarget.Full, iterationId: "it", indicatorParameter: "Key\\A", dataSeries: JSON.stringify(series()), baseline: JSON.stringify(series()) };
    expect(isGoalCreate(body)).toBe(true);
    expect(body.dataSeries).toEqual(series());
    expect(body.baseline).toEqual(series());
  });

  test("Full create rejects identity fields, missing requireds and bad sections", () => {
    const base = { target: GoalDataTarget.Full, iterationId: "it", indicatorParameter: "Key\\A", dataSeries: series() };
    expect(isGoalCreate({ ...base, goalId: "g" })).toBe(false);
    expect(isGoalCreate({ ...base, timestamp: 1 })).toBe(false);
    expect(isGoalCreate({ ...base, iterationId: undefined })).toBe(false);
    expect(isGoalCreate({ ...base, indicatorParameter: undefined })).toBe(false);
    expect(isGoalCreate({ ...base, dataSeries: undefined })).toBe(false);
    expect(isGoalCreate({ ...base, dataSeries: null })).toBe(false);
    expect(isGoalCreate({ ...base, dataSeries: "{not json" })).toBe(false);
    expect(isGoalCreate({ ...base, dataSeries: { dateValues: { "2020": 1 }, unit: "kg" } })).toBe(false);
    expect(isGoalCreate({ ...base, listing: "HIDDEN" })).toBe(false);
    expect(isGoalCreate({ ...base, rawTags: "a,b" })).toBe(false);
    expect(isGoalCreate({ ...base, name: 5 })).toBe(false);
    expect(isGoalCreate({ ...base, dataSeriesRecipe: { equation: "1" } })).toBe(false);
    expect(isGoalCreate({ ...base, baseline: { dateValues: {}, unit: "" } })).toBe(false);
    expect(isGoalCreate({ ...base, recipeSuggestions: [{}] })).toBe(false);
    expect(isGoalCreate({ ...base, copiedFromGoalId: 7 })).toBe(false);
  });

  test("missing or unknown target is rejected on both create and update", () => {
    expect(isGoalCreate({ iterationId: "it", indicatorParameter: "Key\\A", dataSeries: series() })).toBe(false);
    expect(isGoalCreate({ target: "ALL", iterationId: "it", indicatorParameter: "Key\\A", dataSeries: series() })).toBe(false);
    expect(isGoalUpdate({ goalId: "g", timestamp: 1 })).toBe(false);
    expect(isGoalUpdate({ target: "all", goalId: "g", timestamp: 1 })).toBe(false);
    expect(isGoalCreate(null)).toBe(false);
    expect(isGoalCreate([])).toBe(false);
    expect(isGoalUpdate("{}")).toBe(false);
  });

  test("Full update needs goalId and timestamp, everything else optional", () => {
    expect(isGoalUpdate(section(GoalDataTarget.Full))).toBe(true);
    expect(isGoalUpdate(section(GoalDataTarget.Full, { indicatorParameter: "Key\\B", dataSeries: null, historical: series(), name: null }))).toBe(true);
    expect(isGoalUpdate({ target: GoalDataTarget.Full, timestamp: 1 })).toBe(false);
    expect(isGoalUpdate({ target: GoalDataTarget.Full, goalId: "g" })).toBe(false);
    expect(isGoalUpdate(section(GoalDataTarget.Full, { iterationId: "it" }))).toBe(false);
    expect(isGoalUpdate(section(GoalDataTarget.Full, { indicatorParameter: null }))).toBe(false);
  });

  const sectional = [
    { target: GoalDataTarget.DataSeries, good: { dataSeries: series(), dataSeriesRecipe: "{}" }, bad: { dataSeriesRecipeId: 5 } },
    { target: GoalDataTarget.Baseline, good: { baseline: null, baselineRecipe: null }, bad: { baseline: { dateValues: {}, unit: null } } },
    { target: GoalDataTarget.Historical, good: { historical: series(), historicalId: UUID }, bad: { historicalRecipe: {} } },
    { target: GoalDataTarget.RecipeSuggestions, good: { recipeSuggestions: ["{}", "{}"] }, bad: { recipeSuggestions: "{}" } },
  ] as const;

  for (const { target, good, bad } of sectional) {
    test(`${target} section: same shape on create and update`, () => {
      for (const guard of [isGoalCreate, isGoalUpdate]) {
        expect(guard(section(target)), `${guard.name} bare`).toBe(true);
        expect(guard(section(target, good)), `${guard.name} good`).toBe(true);
        expect(guard(section(target, bad)), `${guard.name} bad`).toBe(false);
        expect(guard({ target, timestamp: 1 }), `${guard.name} no goalId`).toBe(false);
        expect(guard({ target, goalId: "g" }), `${guard.name} no timestamp`).toBe(false);
        expect(guard(section(target, { iterationId: "it" })), `${guard.name} iterationId`).toBe(false);
      }
    });

    test(`${target} section: fields of other sections are ignored, not validated`, () => {
      // A sectional request only validates its own fields; a garbage field from
      // another section is passed through (the route only reads its own section)
      const foreign = target === GoalDataTarget.DataSeries ? { baseline: "garbage" } : { dataSeries: "garbage" };
      expect(isGoalCreate(section(target, foreign))).toBe(true);
    });
  }
});

test.describe("recipe guards", () => {
  const scalar = () => ({ id: "s", name: "Scalar", type: RecipeDataTypes.Scalar, value: 2, unit: "kg" });
  const dataSeries = () => ({ id: "d", name: "Series", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, dataSeriesId: UUID, value: null, unit: null });
  const selection = () => [{ variableCode: "Region", valueCodes: ["00", "2580"] }, { variableCode: "ContentsCode", valueCodes: ["BE0101N1"] }];
  const external = () => ({ id: "e", name: "External", type: RecipeDataTypes.External, dataset: "SCB", tableId: "TAB628", selection: selection(), pick: VectorIndexPickerOptions.Last, unit: "invanare" });
  // eslint-disable-next-line no-template-curly-in-string
  const recipe = () => ({ name: "r", equation: "${s} * ${d}", variables: [scalar(), dataSeries(), external()], unit: null, meta: { v: 1 } });

  test("isScalarVariable", () => {
    expect(isScalarVariable(scalar())).toBe(true);
    expect(isScalarVariable({ ...scalar(), unit: undefined, template: true })).toBe(true);
    expect(isScalarVariable({ ...scalar(), value: "2" })).toBe(false);
    expect(isScalarVariable({ ...scalar(), id: " " })).toBe(false);
    expect(isScalarVariable({ ...scalar(), extra: 1 })).toBe(false);
    expect(isScalarVariable({ ...scalar(), type: RecipeDataTypes.DataSeries })).toBe(false);
  });

  test("isDataSeriesVariable", () => {
    expect(isDataSeriesVariable(dataSeries())).toBe(true);
    expect(isDataSeriesVariable({ ...dataSeries(), pick: "2020-01-01T00:00:00.000Z", value: series().dateValues })).toBe(true);
    expect(isDataSeriesVariable({ ...dataSeries(), pick: 3, externalSource: { dataset: "Trafa", tableId: "t10023", selection: selection() } })).toBe(true);
    expect(isDataSeriesVariable({ ...dataSeries(), dataSeriesId: "not-a-uuid" })).toBe(false);
    expect(isDataSeriesVariable({ ...dataSeries(), pick: undefined })).toBe(false);
    expect(isDataSeriesVariable({ ...dataSeries(), pick: 1.5 })).toBe(false);
    expect(isDataSeriesVariable({ ...dataSeries(), value: { "2020": 1 } })).toBe(false);
    expect(isDataSeriesVariable({ ...dataSeries(), externalSource: { dataset: "Nope", tableId: "t", selection: [] } })).toBe(false);
    expect(isDataSeriesVariable({ ...dataSeries(), name: "" })).toBe(false);
  });

  test("isExternalVariable", () => {
    expect(isExternalVariable(external())).toBe(true);
    expect(isExternalVariable({ ...external(), dataset: null, tableId: null, selection: [], dataSeriesId: UUID })).toBe(true);
    expect(isExternalVariable({ ...external(), dataset: "Eurostat" })).toBe(false);
    expect(isExternalVariable({ ...external(), tableId: "" })).toBe(false);
    expect(isExternalVariable({ ...external(), selection: undefined })).toBe(false);
    expect(isExternalVariable({ ...external(), pick: "latest" })).toBe(false);
    expect(isExternalVariable({ ...external(), value: null })).toBe(false);
  });

  test("isExternalSelection", () => {
    expect(isExternalSelection([])).toBe(true);
    expect(isExternalSelection(selection())).toBe(true);
    expect(isExternalSelection({ variableCode: "Region", valueCodes: ["00"] })).toBe(false);
    expect(isExternalSelection([{ variableCode: "", valueCodes: ["00"] }])).toBe(false);
    expect(isExternalSelection([{ variableCode: "Region", valueCodes: ["00", ""] }])).toBe(false);
    expect(isExternalSelection([{ variableCode: "Region", valueCodes: "00" }])).toBe(false);
    expect(isExternalSelection([{ variableCode: "Region" }])).toBe(false);
    expect(isExternalSelection(["Region"])).toBe(false);
  });

  test("isStringifiedExternalSelection", () => {
    expect(isStringifiedExternalSelection(JSON.stringify(selection()))).toBe(true);
    expect(isStringifiedExternalSelection("[]")).toBe(true);
    expect(isStringifiedExternalSelection(selection())).toBe(false);
    expect(isStringifiedExternalSelection("[{variableCode: Region}]")).toBe(false);
    expect(isStringifiedExternalSelection("{}")).toBe(false);
    expect(isStringifiedExternalSelection(JSON.stringify([{ variableCode: "Region", valueCodes: [1] }]))).toBe(false);
  });

  test("isRecipe accepts an object or its JSON, with every variable kind", () => {
    expect(isRecipe(recipe())).toBe(true);
    expect(isRecipe(JSON.stringify(recipe()))).toBe(true);
    expect(isRecipe({ name: "", equation: "", variables: [], meta: {} })).toBe(true);
    expect(isRecipe({ ...recipe(), unit: "kg" })).toBe(true);
    expect(isRecipe({ ...recipe(), unit: undefined })).toBe(true);
  });

  test("isRecipe rejects a bad variable, a missing section, extra keys and bad JSON", () => {
    expect(isRecipe({ ...recipe(), variables: [{ ...scalar(), value: "2" }] })).toBe(false);
    expect(isRecipe({ ...recipe(), variables: [{ id: "x", name: "x", type: "matrix" }] })).toBe(false);
    expect(isRecipe({ ...recipe(), variables: [null] })).toBe(false);
    expect(isRecipe({ ...recipe(), variables: {} })).toBe(false);
    expect(isRecipe({ name: "r", equation: "1", variables: [] })).toBe(false); // no meta
    expect(isRecipe({ ...recipe(), meta: [] })).toBe(false);
    expect(isRecipe({ ...recipe(), unit: 5 })).toBe(false);
    expect(isRecipe({ ...recipe(), equation: undefined })).toBe(false);
    expect(isRecipe({ ...recipe(), evaluated: true })).toBe(false);
    expect(isRecipe("{name:")).toBe(false);
    expect(isRecipe([recipe()] as JSONValue)).toBe(false);
    expect(isRecipe(null)).toBe(false);
  });
});
