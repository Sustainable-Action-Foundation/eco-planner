import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";
import { isRecipeDataSeries, isRecipeExternalDataset, isRecipeExternalDatasetSelection, isRecipeScalar, RecipeDataTypes, RecipeError, RecipeVariable, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import getTableContent from "@/lib/api/getTableContent";
import mathjs from "@/math";
import { DataSeriesValueFields, DataSeriesValueFieldsWithUnit, nullFullDataSeriesValueField, Years } from "@/types";
import { Unit } from "mathjs";
import { EvalTimeVariable } from "./types";

export function extractScalars(variables: Record<string, RecipeVariable>): EvalTimeVariable[] {
  const scalars: EvalTimeVariable[] = [];

  for (const varName in variables) {
    const variable = variables[varName];
    if (variable.type !== RecipeDataTypes.Scalar) continue;
    if (!isRecipeScalar(variable)) continue;

    scalars.push({
      name: varName,
      value: variable.unit ? mathjs.unit(variable.value, variable.unit) : mathjs.unit(variable.value),
    });
  }

  return scalars;
}

export async function extractDataSeries(variables: Record<string, RecipeVariable>): Promise<EvalTimeVariable[]> {
  const dataSeries: EvalTimeVariable[] = [];

  for (const varName in variables) {
    const variable = variables[varName];
    if (variable.type !== RecipeDataTypes.DataSeries) continue;
    if (!isRecipeDataSeries(variable)) continue;

    let dbDataSeries: Awaited<ReturnType<typeof clientSafeGetOneDataSeries>>;
    if (variable.link) {
      dbDataSeries = await clientSafeGetOneDataSeries(variable.link);
    }
    else if (variable.value || Array.isArray(variable.value)) {
      dbDataSeries = {
        id: "inline",
        unit: variable.unit || null,
        ...nullFullDataSeriesValueField,
        ...variable.value,
      };
    }
    else {
      throw new RecipeError(`extractDataSeries: Data series variable missing link Variable "${varName}" is of type DataSeries but has no link defined.`);
    }

    if (!dbDataSeries) {
      throw new RecipeError(`extractDataSeries: Failed to fetch data series for variable "${varName}" with link "${variable.link}".`);
    }

    const unit = getPrevailingUnit(dbDataSeries.unit, variable.unit);
    const vectorOrScalar = pickVector(convertYearValuePairToVector(dbDataSeries), variable.pick);
    dataSeries.push({
      name: varName,
      value: Array.isArray(vectorOrScalar) ?
        vectorOrScalar.map(v => unit ? mathjs.unit(v, unit) : mathjs.unit(v))
        :
        unit ? mathjs.unit(vectorOrScalar, unit) : mathjs.unit(vectorOrScalar),
    });
  }

  return dataSeries;
}

export async function extractExternalDatasets(variables: Record<string, RecipeVariable>): Promise<EvalTimeVariable[]> {
  const externalDatasets: EvalTimeVariable[] = [];

  const fetchers: Array<() => Promise<void>> = [];

  for (const varName in variables) {
    const variable = variables[varName];
    if (variable.type !== RecipeDataTypes.External) continue;
    if (!isRecipeExternalDataset(variable)) {
      throw new RecipeError(`Variable '${varName}', typed as '${(variable as { type: string }).type} ' is not a valid RecipeExternalDataset.`);
    }

    const { dataset, tableId, selection } = variable;

    if (!dataset || !tableId || !isRecipeExternalDatasetSelection(selection)) { // These props may all be null
      throw new RecipeError(`External dataset variable '${varName}' is missing 'dataset', 'tableId' and/or 'selection' properties.`);
    }

    fetchers.push(async () => {
      const data = await getTableContent(tableId, dataset, selection);

      if (!data) {
        throw new RecipeError(`External dataset variable '${varName}' has no data for tableId '${tableId}' and dataset '${dataset}'.`);
      }
      if (data.values.length === 0) {
        throw new RecipeError(`External dataset variable '${varName}' has no values. Expected an array of values with 'period' and 'value' properties.`);
      }

      const definedValues: Partial<DataSeriesValueFields> = {};
      for (const year of Years) {
        const found = data.values.find(v => v.period === year);
        if (found) {
          definedValues[year] = parseFloat(found.value);
        }
      }

      const vectorOrScalar = pickVector(convertYearValuePairToVector(definedValues), variable.pick);
      externalDatasets.push({
        name: varName,
        value: Array.isArray(vectorOrScalar) ? vectorOrScalar.map(v => mathjs.unit(v, variable.unit || undefined)) : mathjs.unit(vectorOrScalar, variable.unit || undefined),
      });
    });
  }

  await Promise.all(fetchers.map(fetcher => fetcher()));

  return externalDatasets;
}

function convertYearValuePairToVector(dataSeries: Partial<DataSeriesValueFields>): number[] {
  const vector: number[] = [];

  // TODO move this definition to a higher scope
  const nonDefinedValue = Infinity; // Mathjs does not like undefined values so this is the intermediate representation 
  const missingValue = 0; // Missing leading values are represented as 0 to align with the years properly

  const lastDefinedYear = Years.slice().reverse().find(year => {
    return typeof dataSeries[year] === "number";
  });

  if (!lastDefinedYear) {
    throw new RecipeError("convertYearValuePairToVector: Data series contains no defined numeric values.");
  }

  // Map to vector with special handling for missing and null values
  for (const year of Years) {
    if (typeof dataSeries[year] === "undefined") { // Missing in input
      if (lastDefinedYear && year < lastDefinedYear) {
        vector.push(missingValue);
      }
      vector.push(missingValue);
    }

    else if (dataSeries[year] === null) { // Explicitly null in input
      vector.push(nonDefinedValue);
    }

    else if (typeof dataSeries[year] !== "number") {
      throw new RecipeError(`convertYearValuePairToVector: Invalid data type for year ${year}. Expected number or null, got ${typeof dataSeries[year]}.`);
    }

    // Defined number value
    else {
      vector.push(dataSeries[year]);
    }
  }

  return vector;
}

export function convertVectorToYearValuePair(vector: Unit[]): DataSeriesValueFieldsWithUnit {
  const dataSeries: DataSeriesValueFields = { ...nullFullDataSeriesValueField };

  // TODO move this definition to a higher scope
  const nonDefinedValue = Infinity; // Mathjs does not like undefined values so this is the intermediate representation 
  const missingValue = 0; // Missing leading values are represented as 0 to align with the years properly

  for (let i = 0; i < Years.length; i++) {
    const year = Years[i];
    const v = vector[i];

    if (v.value === missingValue) {
      dataSeries[year] = null;
    }
    else if (!isFinite(v.value) || v.value === nonDefinedValue) {
      dataSeries[year] = null;
    }
    else {
      dataSeries[year] = v.value;
    }
  }

  // If all units are the same, return that unit, else undefined
  const units = vector.map(v => v.formatUnits())
  const uniqueUnits = Array.from(new Set(units));
  if (uniqueUnits.length === 1) {
    return {
      ...dataSeries,
      unit: uniqueUnits[0],
    };
  }
  else {
    console.warn(`convertVectorToYearValuePair: Inconsistent units in result vector: ${uniqueUnits.join(", ")}. Setting unit to undefined.`);
    return {
      ...dataSeries,
      unit: undefined,
    };
  }
}

function getPrevailingUnit(existingUnit: string | null | undefined, newUnit: string | null | undefined): string | null | undefined {
  // If the new unit is explicitly set (string or null), it takes precedence
  if (typeof newUnit !== "undefined" && !newUnit?.trim()) {
    return newUnit;
  }
  // Otherwise, keep the existing unit
  return existingUnit;
}

function pickVector(vector: number[], pick: VectorIndexPickerOptions): number | number[] {
  switch (pick) {
    case VectorIndexPickerOptions.Whole:
      return vector;

    case VectorIndexPickerOptions.First:
      const first = vector.at(0);
      if (first === undefined) {
        throw new RecipeError("pickVector: Vector is empty, cannot pick the first element.");
      }
      return first;

    case VectorIndexPickerOptions.Last:
      const last = vector.at(-1);
      if (last === undefined) {
        throw new RecipeError("pickVector: Vector is empty, cannot pick the last element.");
      }
      return last;

    case VectorIndexPickerOptions.Mean:
      const sum = vector.reduce((acc, val) => acc + val, 0);
      return sum / vector.length;

    case VectorIndexPickerOptions.Median:
      const sorted = [...vector].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      else {
        return sorted[mid];
      }

    default:
      throw new RecipeError(`pickVector: Unknown VectorIndexPickerOption '${pick as string}'.`);
  }
}