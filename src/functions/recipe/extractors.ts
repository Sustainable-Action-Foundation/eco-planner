import { isDataSeriesVariable, isExternalSelection, isScalarVariable, RecipeDataTypes, RecipeError } from "@/functions/recipe/types";
import type { DataSeriesVariable, EvalTimeSeries, ExternalVariable, RecipeExtractionOutput, RecipeVariable, EvalTimeVariable } from "@/functions/recipe/types";
import getTableContent from "@/lib/api/getTableContent";
import type { ApiSelectionItem, ApiTableContent } from "@/lib/api/apiTypes";
import mathjs from "@/math";
import type { DataSeries, DateValues, DateValuesWithUnit } from "@/types";
import { isISOIshDate } from "@/types/typeguards";
import { filterToInitialYearlyRecords, parsePeriod } from "@/lib/api/utility";
import { getPrevailingUnit, isMathjsUnit, pickDateValues } from "@/functions/recipe/vectorAndMaskUtils";

/**
 * Produces a stable, order-insensitive key identifying an external selection
 * (dataset + table + selection). Two selections that fetch the same data produce
 * the same key, so it can be used to dedupe/cache fetches or compare selections.
 */
export function externalSelectionKey(
  dataset: string | null,
  tableId: string | null,
  selection: ApiSelectionItem[],
): string {
  const normalizedSelection = [...selection]
    .map(item => ({ variableCode: item.variableCode, valueCodes: [...item.valueCodes].sort() }))
    .sort((a, b) => a.variableCode.localeCompare(b.variableCode));
  return JSON.stringify([dataset, tableId, normalizedSelection]);
}

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
  externalTableContentGetter: (tableId: string, dataset: string, selection: ApiSelectionItem[]) => Promise<ApiTableContent | null> = getTableContent,
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
    const parsedValue = parseFloat(valuePeriod.value); // TODO: what is the preferred way to parse these values?
    if (!Number.isFinite(parsedValue)) {
      warnings.push(`External dataset variable "${variable.name}" has a non-numeric value "${valuePeriod.value}" for period "${valuePeriod.period}"; skipping it.`);
      continue;
    }
    timeline[isoDateString] = parsedValue;
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
  dataSeriesGetter?: (dataSeriesId: string) => Promise<DataSeries | null>,
): Promise<RecipeExtractionOutput> {
  const dataSeries: RecipeExtractionOutput = [];

  for (const variable of variables) {
    if (variable.type !== RecipeDataTypes.DataSeries) continue;
    if (!isDataSeriesVariable(variable)) continue;

    let dbDataSeries: DataSeries | null;
    if (variable.dataSeriesId) {
      if (!dataSeriesGetter) {
        throw new RecipeError(`VariableExtractor: no data series getter provided to resolve "${variable.dataSeriesId}" for variable "${variable.name}".`);
      }

      dbDataSeries = await dataSeriesGetter(variable.dataSeriesId)
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
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

    dataSeries.push(dbDataSeriesToExtraction(dbDataSeries, variable, warnings));
  }

  return dataSeries;
}

/**
 * Builds the evaluation output for a variable backed by a stored `DataSeries`
 * (unit resolution, date-value mapping, and `pick`). Shared by data-series
 * variables and external variables that have been materialized into a series.
 */
function dbDataSeriesToExtraction(
  dbDataSeries: DataSeries,
  variable: DataSeriesVariable | ExternalVariable,
  warnings: string[],
): EvalTimeVariable | EvalTimeSeries {
  const bestUnit = getPrevailingUnit(dbDataSeries.unit, variable.unit);
  const isValidUnit = isMathjsUnit(bestUnit);
  if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variable.name}" has an invalid unit "${bestUnit}". Treating as unitless during evaluation.`);
  const unit = isValidUnit ? bestUnit : undefined;

  // Normalize each value to its year boundary so keys align with the year-indexed
  // vector built in transformDateValuesToVector (which only looks up `${year}-01-01`).
  // Non-Jan-1 timestamps would otherwise be silently masked out of evaluation.
  const dateValues: DateValues = Object.fromEntries(
    dbDataSeries.values.map(v => ([
      new Date(`${new Date(v.timestamp).getUTCFullYear()}-01-01T00:00:00Z`).toISOString(),
      v.value,
    ])),
  );

  if (Object.keys(dateValues).some(k => !isISOIshDate(k))) {
    throw new RecipeError(`Data series variable "${variable.name}" contains invalid ISOIshDate keys.`);
  }

  const picked = pickDateValues({ dateValues, unit }, variable.pick);

  return picked instanceof mathjs.Unit
    ? { id: variable.id, displayName: variable.name, value: picked }
    : { id: variable.id, displayName: variable.name, series: picked };
}

export async function extractExternalDatasets(
  variables: RecipeVariable[],
  warnings: string[] = [],
  externalTableContentGetter: (tableId: string, dataset: string, selection: ApiSelectionItem[]) => Promise<ApiTableContent | null> = getTableContent,
  dataSeriesGetter?: (dataSeriesId: string) => Promise<DataSeries | null>,
): Promise<RecipeExtractionOutput> {

  const externalDatasets: RecipeExtractionOutput = [];
  const fetchers: Array<() => Promise<void>> = [];

  for (const variable of variables) {
    if (variable.type !== RecipeDataTypes.External) continue;

    fetchers.push(async () => {
      // Canon: if the variable points at a materialized DataSeries, read it from
      // the DB instead of re-fetching the upstream API. Only fetch when there is
      // no materialized series (a brand-new or just-changed selection).
      if (variable.dataSeriesId) {
        if (!dataSeriesGetter) {
          throw new RecipeError(`VariableExtractor: no data series getter provided to resolve "${variable.dataSeriesId}" for external variable "${variable.name}".`);
        }

        const dbDataSeries = await dataSeriesGetter(variable.dataSeriesId)
          .catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            throw new RecipeError(`VariableExtractor: Error fetching data series for external variable "${variable.name}" with link "${variable.dataSeriesId}": ${errorMessage}`);
          });

        if (dbDataSeries) {
          externalDatasets.push(dbDataSeriesToExtraction(dbDataSeries, variable, warnings));
          return;
        }
        // Materialized series missing — fall back to fetching from the API.
        warnings.push(`External variable "${variable.name}" references missing data series "${variable.dataSeriesId}"; falling back to a live fetch.`);
      }

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