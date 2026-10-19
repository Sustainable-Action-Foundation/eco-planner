import { expect, test } from "playwright/test";

import { getHistoricalDataset, getHistoricalDatasetFromRecipe, getHistoricalSource, getHistoricalSourceFromRecipe } from "../../src/functions/getHistoricalDataset";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../../src/functions/recipe/types";
import { ExternalDataset } from "../../src/lib/api/utility";
import { UnitFlags } from "../../src/types/enums";
import type { Goal } from "../../src/types";

const selection = [
  { variableCode: "metric", valueCodes: ["itrfslut"] },
  { variableCode: "drivmedel", valueCodes: ["103"] },
];

/** An edit-time recipe: the external variable has not been materialized yet */
const externalVariable: ExternalVariable = {
  id: "external-id",
  name: "Elbilar i Boden",
  type: RecipeDataTypes.External,
  pick: VectorIndexPickerOptions.Default,
  unit: UnitFlags.Missing,
  dataset: "Trafa",
  tableId: "t10026",
  selection,
};

/** A stored recipe: the external variable was materialized into a data series carrying its source */
const materializedVariable: DataSeriesVariable = {
  id: "series-id",
  name: "Elbilar i Boden (lagrad)",
  type: RecipeDataTypes.DataSeries,
  pick: VectorIndexPickerOptions.Default,
  unit: UnitFlags.Missing,
  dataSeriesId: "00000000-0000-4000-8000-000000000001",
  value: null,
  externalSource: { dataset: "Trafa", tableId: "t10026", selection },
};

const scalar: ScalarVariable = { id: "scalar-id", name: "faktor", type: RecipeDataTypes.Scalar, value: 2, unit: UnitFlags.Unitless };

const plainSeries: DataSeriesVariable = {
  id: "plain-id",
  name: "manuell",
  type: RecipeDataTypes.DataSeries,
  pick: VectorIndexPickerOptions.Default,
  unit: UnitFlags.Missing,
  dataSeriesId: "00000000-0000-4000-8000-000000000002",
  value: null,
};

function recipe(...variables: (ExternalVariable | DataSeriesVariable | ScalarVariable)[]): Recipe {
  return new Recipe({ name: "historisk", equation: variables.map(variable => `\${${variable.id}}`).join(" * "), variables });
}

/** Only `historical.recipe_used.recipe` is read, so the rest of the Prisma payload is left out */
function goalWith(recipeJson: string | null | undefined): Pick<Goal, "historical"> {
  return { historical: recipeJson === undefined ? null : { recipe_used: { recipe: recipeJson } } } as unknown as Pick<Goal, "historical">;
}

test.describe("getHistoricalSourceFromRecipe", () => {
  test("reads a raw external variable", () => {
    expect(getHistoricalSourceFromRecipe(recipe(scalar, externalVariable))).toEqual({
      id: "external-id",
      name: "Elbilar i Boden",
      dataset: "Trafa",
      tableId: "t10026",
      selection,
    });
  });

  test("reads a materialized data series through its externalSource meta", () => {
    expect(getHistoricalSourceFromRecipe(recipe(materializedVariable, scalar))).toEqual({
      id: "series-id",
      name: "Elbilar i Boden (lagrad)",
      dataset: "Trafa",
      tableId: "t10026",
      selection,
    });
  });

  test("takes the first source when a recipe has several", () => {
    expect(getHistoricalSourceFromRecipe(recipe(materializedVariable, externalVariable))?.id).toBe("series-id");
    expect(getHistoricalSourceFromRecipe(recipe(externalVariable, materializedVariable))?.id).toBe("external-id");
  });

  test("keeps an incomplete selection as it is", () => {
    const unfinished: ExternalVariable = { ...externalVariable, dataset: null, tableId: null, selection: [] };
    expect(getHistoricalSourceFromRecipe(recipe(unfinished))).toEqual({ id: "external-id", name: "Elbilar i Boden", dataset: null, tableId: null, selection: [] });
  });

  test("returns null without an external source, or without a recipe", () => {
    expect(getHistoricalSourceFromRecipe(recipe(scalar, plainSeries))).toBeNull();
    expect(getHistoricalSourceFromRecipe(recipe())).toBeNull();
    expect(getHistoricalSourceFromRecipe(null)).toBeNull();
    expect(getHistoricalSourceFromRecipe(undefined)).toBeNull();
  });
});

test.describe("getHistoricalSource", () => {
  test("deserializes the stored recipe and survives a round trip", () => {
    const stored = recipe(materializedVariable).serialize();
    expect(getHistoricalSource(goalWith(stored))).toEqual({
      id: "series-id",
      name: "Elbilar i Boden (lagrad)",
      dataset: "Trafa",
      tableId: "t10026",
      selection,
    });
  });

  test("returns null for goals without historical data or with a stored recipe that cannot be read", () => {
    expect(getHistoricalSource(goalWith(undefined))).toBeNull();
    expect(getHistoricalSource(goalWith(null))).toBeNull();
    expect(getHistoricalSource(goalWith(""))).toBeNull();
    expect(getHistoricalSource(goalWith("not json"))).toBeNull();
    expect(getHistoricalSource(goalWith(JSON.stringify({ name: "x" })))).toBeNull();
    expect(getHistoricalSource(goalWith(recipe(scalar).serialize()))).toBeNull();
  });
});

test.describe("dataset attribution", () => {
  test("resolves the dataset and uses the variable name as label", () => {
    expect(getHistoricalDatasetFromRecipe(recipe(externalVariable))).toEqual({ dataset: ExternalDataset.Trafa, label: "Elbilar i Boden" });
    expect(getHistoricalDataset(goalWith(recipe(materializedVariable).serialize()))).toEqual({ dataset: ExternalDataset.Trafa, label: "Elbilar i Boden (lagrad)" });
  });

  test("resolves datasets case-insensitively and by alternate name", () => {
    const scb: ExternalVariable = { ...externalVariable, dataset: "scb" as ExternalVariable["dataset"], tableId: "TAB628" };
    expect(getHistoricalDatasetFromRecipe(recipe(scb)).dataset).toBe(ExternalDataset.SCB);
  });

  test("an unset dataset or unknown name gives no dataset, and an empty name no label", () => {
    const unnamed: ExternalVariable = { ...externalVariable, name: "", dataset: null };
    expect(getHistoricalDatasetFromRecipe(recipe(unnamed))).toEqual({ dataset: null, label: null });
    const unknown: ExternalVariable = { ...externalVariable, dataset: "Eurostat" as ExternalVariable["dataset"] };
    expect(getHistoricalDatasetFromRecipe(recipe(unknown))).toEqual({ dataset: null, label: "Elbilar i Boden" });
  });

  test("no source means no attribution", () => {
    expect(getHistoricalDatasetFromRecipe(recipe(scalar))).toEqual({ dataset: null, label: null });
    expect(getHistoricalDatasetFromRecipe(null)).toEqual({ dataset: null, label: null });
    expect(getHistoricalDataset(goalWith(undefined))).toEqual({ dataset: null, label: null });
  });
});
