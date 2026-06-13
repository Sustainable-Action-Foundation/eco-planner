import { isDataSeriesVariable, isExternalSelection, isScalarVariable, RecipeDataTypes, RecipeError } from "@/functions/recipe/types";
import type { ExternalVariable, RecipeExtractionOutput, RecipeVariable, EvalTimeVariable } from "@/functions/recipe/types";
import getTableContent from "@/lib/api/getTableContent";
import type { ApiTableContent } from "@/lib/api/apiTypes";
import mathjs from "@/math";
import { isISOIshDate } from "@/types";
import type { DataSeries, DateValues, DateValuesWithUnit } from "@/types";
import { filterToInitialYearlyRecords, parsePeriod } from "@/lib/api/utility";
import { getPrevailingUnit, isMathjsUnit, pickDateValues } from "@/functions/recipe/vectorAndMaskUtils";

/**
 * Fetches the data for a single external variable and parses it into a
 * {@link DateValuesWithUnit} (the full fetched series, before any `pick`).
 *
 * Used both during evaluation (edit-time preview) and when materializing an
 * external variable into a stored `DataSeries` on save.
 */
export async function fetchExternalVariableData(
  variable: ExternalVariable,
  warnings: string[] = [],
  externalTableContentGetter: (tableId: string, dataset: string, selection: { variableCode: string, valueCodes: string[] }[]) => Promise<ApiTableContent | null> = getTableContent,
): Promise<DateValuesWithUnit> {
  const { dataset, tableId, selection } = variable;

  if (!dataset || !tableId || !isExternalSelection(selection)) { // These props may all be null
    throw new RecipeError(`External dataset variable '${variable.name}' (id: '${variable.id}') is missing 'dataset', 'tableId' and/or 'selection' properties.`);
  }

  const data = await externalTableContentGetter(tableId, dataset, selection);

  if (!data) {
    throw new RecipeError(`External dataset variable '${variable.name}' (id: '${variable.id}') has no data for tableId '${tableId}' and dataset '${dataset}' and selection '${JSON.stringify(selection)}'.`);
  }
  if (data.values.length === 0) {
    throw new RecipeError(`External dataset variable '${variable.name}' (id: '${variable.id}') has no values. Expected an array of values with 'period' and 'value' properties.`);
  }

  const timeline: DateValues = {};

  const fetchedValues = filterToInitialYearlyRecords(data.values);
  for (const valuePeriod of fetchedValues) {
    const parsedDate = parsePeriod(valuePeriod.period);
    const isoDateString = new Date(`${parsedDate.getUTCFullYear()}-01-01T00:00:00Z`).toISOString();
    if (!isISOIshDate(isoDateString)) {
      throw new RecipeError(`External dataset variable "${variable.name}" contains invalid ISOIshDate keys after parsing period "${valuePeriod.period}".`);
    }
    timeline[isoDateString] = parseFloat(valuePeriod.value); // TODO: what is the preferred way to parse these values?
  }

  // TODO: how should units be derived here? I can't find anything in the API response that indicates units.
  const bestUnit = getPrevailingUnit(undefined, variable.unit);
  const isValidUnit = isMathjsUnit(bestUnit);
  if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variable.name}" has an invalid unit "${bestUnit}". Treating as unitless.`);
  const unit = isValidUnit ? bestUnit : undefined;

  return { dateValues: timeline, unit };
}

export function extractScalars(
  variables: RecipeVariable[],
  warnings: string[] = [],
): EvalTimeVariable[] {
  const scalars: EvalTimeVariable[] = [];

  for (const variable of variables) {
    if (variable.type !== RecipeDataTypes.Scalar) continue;
    if (!isScalarVariable(variable)) continue;

    const bestUnit = getPrevailingUnit(undefined, variable.unit);
    const isValidUnit = isMathjsUnit(bestUnit);
    if (bestUnit && !isValidUnit) warnings.push(`Scalar variable "${variable.name}" has an invalid unit "${bestUnit}". Treating as unitless.`);
    const unit = isValidUnit ? bestUnit : undefined;

    scalars.push({
      id: variable.id,
      displayName: variable.name,
      value: unit
        ? mathjs.unit(variable.value, unit)
        : mathjs.unit(variable.value),
    });
  }

  return scalars;
}

export async function extractDataSeries(
  variables: RecipeVariable[],
  warnings: string[] = [],
  overrideDataSeriesGetter?: (dataSeriesId: string) => Promise<DataSeries | null>,
): Promise<RecipeExtractionOutput> {
  const dataSeries: RecipeExtractionOutput = [];

  for (const variable of variables) {
    if (variable.type !== RecipeDataTypes.DataSeries) continue;
    if (!isDataSeriesVariable(variable)) continue;

    let dbDataSeries: DataSeries | null;
    if (variable.dataSeriesId) {
      const dataSeriesGetter = overrideDataSeriesGetter
        ?? (await import("@/fetchers/client")).clientSafeGetOneDataSeries;

      dbDataSeries = await dataSeriesGetter(variable.dataSeriesId)
        .catch((e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : String(e);
          throw new RecipeError(`VariableExtractor: Error fetching data series for variable "${variable.name}" with link "${variable.dataSeriesId}": ${errorMessage}`);
        });
    }
    else if (variable.value) {
      // TODO: maybe remove this "exception" or at least make the id more robust
      const inlineId = "inline-" + Math.random().toString(36).substring(2, 15); // TODO: better unique id
      dbDataSeries = {
        id: inlineId,
        unit: variable.unit ?? null,
        values: Object.entries(variable.value).map(([key, val]) => ({
          dataSeriesId: inlineId,
          timestamp: new Date(key), // TODO, fix very naive parsing
          value: val,
        })),
      };
    }
    else {
      throw new RecipeError(`VariableExtractor: Variable "${variable.name}" is not referencing a goal or data series.`);
    }

    if (!dbDataSeries) {
      throw new RecipeError(`VariableExtractor: Failed to fetch data series for variable "${variable.name}" with link "${variable.dataSeriesId}".`);
    }

    const bestUnit = getPrevailingUnit(dbDataSeries.unit, variable.unit);
    const isValidUnit = isMathjsUnit(bestUnit);
    if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variable.name}" has an invalid unit "${bestUnit}". Treating as unitless during evaluation.`);
    const unit = isValidUnit ? bestUnit : undefined;

    const dateValues: DateValues = Object.fromEntries(
      dbDataSeries.values.map(v => ([
        new Date(v.timestamp).toISOString(),
        v.value,
      ])),
    );

    if (Object.keys(dateValues).some(k => !isISOIshDate(k))) {
      throw new RecipeError(`Data series variable "${variable.name}" contains invalid ISOIshDate keys.`);
    }

    const picked = pickDateValues({ dateValues, unit }, variable.pick);

    if (picked instanceof mathjs.Unit) {
      dataSeries.push({
        id: variable.id,
        displayName: variable.name,
        value: picked,
      });
    }
    else {
      dataSeries.push({
        id: variable.id,
        displayName: variable.name,
        series: picked,
      });
    }
  }

  return dataSeries;
}

export async function extractExternalDatasets(
  variables: RecipeVariable[],
  warnings: string[] = [],
  externalTableContentGetter: (tableId: string, dataset: string, selection: { variableCode: string, valueCodes: string[] }[]) => Promise<ApiTableContent | null> = getTableContent,
): Promise<RecipeExtractionOutput> {

  const externalDatasets: RecipeExtractionOutput = [];
  const fetchers: Array<() => Promise<void>> = [];

  for (const variable of variables) {
    if (variable.type !== RecipeDataTypes.External) continue;

    fetchers.push(async () => {
      const fetched = await fetchExternalVariableData(variable, warnings, externalTableContentGetter);

      const picked = pickDateValues(fetched, variable.pick);

      if (picked instanceof mathjs.Unit) {
        externalDatasets.push({
          id: variable.id,
          displayName: variable.name,
          value: picked,
        });
      }
      else {
        externalDatasets.push({
          id: variable.id,
          displayName: variable.name,
          series: picked,
        });
      }
    });
  }

  await Promise.all(fetchers.map(fetcher => fetcher()));

  return externalDatasets;
}