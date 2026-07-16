import type { DatasetKeys } from "@/lib/api/apiTypes";
import { ExternalDataset } from "@/lib/api/utility";
import { isDateValuesWithUnit, isStandardObject, isDateValues, isISOIshDate, uuidRegex } from "@/types";
import type { JSONValue } from "@/types";
import mathjs from "@/math";

import { RecipeDataTypes, VectorIndexPickerOptions } from "./consts";
import type {
  EvalTimeVariable,
  DataSeriesVariable,
  ExternalVariable,
  ScalarVariable,
  RecipeShape,
  EvalTimeSeries,
  RecipeExtractionOutput,
} from "@/functions/recipe/types";

function isRecipePickValue(pick: unknown): pick is DataSeriesVariable["pick"] {
  // "first" | "last" | ... or ISO-ish date string
  if (typeof pick === "string") {
    if (
      Object.values(VectorIndexPickerOptions).includes(pick as VectorIndexPickerOptions)
      || isISOIshDate(pick)
    ) {
      return true;
    }
  }

  // Integer index
  if (typeof pick === "number" && Number.isInteger(pick)) {
    return true;
  }

  return false;
}

export function isScalarVariable(variable: JSONValue): variable is ScalarVariable {
  const allowedProps = ["id", "name", "type", "unit", "template", "value"];

  if (!isStandardObject(variable)) {
    console.warn("Type guard: scalar variable should be an object", variable);
    return false;
  }
  const scalar = variable as Record<string, unknown>;

  // .type: RecipeDataTypes.Scalar
  if (scalar.type !== RecipeDataTypes.Scalar) {
    console.warn("Type guard: 'type' in scalar variable", variable);
    return false;
  }

  // .id: non-empty string
  if (typeof scalar.id !== "string" || scalar.id.trim() === "") {
    console.warn("Type guard: 'id' in scalar variable", variable);
    return false;
  }

  // .value: number
  if (typeof scalar.value !== "number") {
    console.warn("Type guard: 'value' in scalar variable", variable);
    return false;
  }

  // .unit: string | null | undefined
  if (typeof scalar.unit !== "string" && scalar.unit !== null && scalar.unit !== undefined) {
    console.warn("Type guard: 'unit' in scalar variable", variable);
    return false;
  }

  // .name: non-empty string
  const name = scalar.name;
  if (typeof name !== "string" || name.trim() === "") {
    console.warn("Type guard: 'name' in scalar variable", variable);
    return false;
  }

  // .template: boolean | undefined
  if (scalar.template !== undefined && typeof scalar.template !== "boolean") {
    console.warn("Type guard: 'template' in scalar variable", variable);
    return false;
  }

  if (Object.keys(scalar).some(key => !allowedProps.includes(key))) {
    console.warn("Type guard: unknown properties in scalar variable", variable);
    return false;
  }

  return true;
}

export function isDataSeriesVariable(variable: JSONValue): variable is DataSeriesVariable {
  const allowedProps = ["id", "name", "type", "unit", "template", "pick", "dataSeriesId", "value", "externalSource"];
  if (!isStandardObject(variable)) {
    console.warn("Type guard: data series variable should be an object", variable);
    return false;
  }
  const dataSeries = variable as Record<string, unknown>;

  // .type: RecipeDataTypes.DataSeries
  if (dataSeries.type !== RecipeDataTypes.DataSeries) {
    console.warn("Type guard: 'type' in data series variable", variable);
    return false;
  }

  // .id: non-empty string
  if (typeof dataSeries.id !== "string" || dataSeries.id.trim() === "") {
    console.warn("Type guard: 'id' in data series variable", variable);
    return false;
  }

  // .dataSeriesId: UUID string | null | undefined
  const dataSeriesId = dataSeries.dataSeriesId;
  if (
    dataSeriesId !== null
    && dataSeriesId !== undefined
    && (typeof dataSeriesId !== "string" || !uuidRegex.test(dataSeriesId))
  ) {
    console.warn("Type guard: 'dataSeriesId' in data series variable", variable);
    return false;
  }

  // .pick: required
  if (!isRecipePickValue(dataSeries.pick)) {
    console.warn("Type guard: 'pick' in data series variable", variable);
    return false;
  }

  // .unit: string | null | undefined
  if (typeof dataSeries.unit !== "string" && dataSeries.unit !== null && dataSeries.unit !== undefined) {
    console.warn("Type guard: 'unit' in data series variable", variable);
    return false;
  }

  // .value: DateValues | null | undefined
  if (dataSeries.value !== undefined && dataSeries.value !== null && !isDateValues(dataSeries.value)) {
    console.warn("Type guard: 'value' in data series variable", variable);
    return false;
  }

  // .externalSource: ExternalSource | null | undefined
  const externalSource = dataSeries.externalSource;
  if (externalSource !== undefined && externalSource !== null) {
    if (!isStandardObject(externalSource)) {
      console.warn("Type guard: 'externalSource' in data series variable should be an object", variable);
      return false;
    }
    const source = externalSource as Record<string, unknown>;
    if (
      source.dataset !== null
      && (typeof source.dataset !== "string" || !ExternalDataset.knownDatasetKeys.includes(source.dataset as DatasetKeys))
    ) {
      console.warn("Type guard: 'externalSource.dataset' in data series variable", variable);
      return false;
    }
    if (source.tableId !== null && (typeof source.tableId !== "string" || source.tableId.trim() === "")) {
      console.warn("Type guard: 'externalSource.tableId' in data series variable", variable);
      return false;
    }
    if (!isExternalSelection(source.selection as JSONValue)) {
      console.warn("Type guard: 'externalSource.selection' in data series variable", variable);
      return false;
    }
  }

  // .name: non-empty string
  const name = dataSeries.name;
  if (typeof name !== "string" || name.trim() === "") {
    console.warn("Type guard: 'name' in data series variable", variable);
    return false;
  }

  // .template: boolean | undefined
  if (dataSeries.template !== undefined && typeof dataSeries.template !== "boolean") {
    console.warn("Type guard: 'template' in data series variable", variable);
    return false;
  }

  if (Object.keys(dataSeries).some(key => !allowedProps.includes(key))) {
    console.warn("Type guard: unknown properties in data series variable", variable);
    return false;
  }

  return true;
}

export function isExternalVariable(variable: JSONValue): variable is ExternalVariable {
  const allowedProps = ["id", "name", "type", "unit", "template", "dataset", "tableId", "selection", "pick", "dataSeriesId"];
  if (!isStandardObject(variable)) {
    console.warn("Type guard: external dataset variable should be an object", variable);
    return false;
  }
  const external = variable as Record<string, unknown>;

  // .type: RecipeDataTypes.External
  if (external.type !== RecipeDataTypes.External) {
    console.warn("Type guard: 'type' in external dataset variable", variable);
    return false;
  }

  // .dataSeriesId: UUID string | null | undefined
  if (
    external.dataSeriesId !== null
    && external.dataSeriesId !== undefined
    && (typeof external.dataSeriesId !== "string" || !uuidRegex.test(external.dataSeriesId))
  ) {
    console.warn("Type guard: 'dataSeriesId' in external dataset variable", variable);
    return false;
  }

  // .id: non-empty string
  if (typeof external.id !== "string" || external.id.trim() === "") {
    console.warn("Type guard: 'id' in external dataset variable", variable);
    return false;
  }

  // .dataset: known dataset key | null
  const dataset = external.dataset;
  if (
    dataset !== null
    && (
      typeof dataset !== "string"
      || !ExternalDataset.knownDatasetKeys.includes(dataset as DatasetKeys)
    )
  ) {
    console.warn("Type guard: 'dataset' in external dataset variable", variable);
    return false;
  }

  // .tableId: non-empty string | null
  const tableId = external.tableId;
  if (
    tableId !== null
    && (typeof tableId !== "string" || tableId.trim() === "")
  ) {
    console.warn("Type guard: 'tableId' in external dataset variable", variable);
    return false;
  }

  // .selection: required array of selection items
  if (!isExternalSelection(external.selection as JSONValue)) {
    console.warn("Type guard: 'selection' in external dataset variable", variable);
    return false;
  }

  // .pick: required
  if (!isRecipePickValue(external.pick)) {
    console.warn("Type guard: 'pick' in external dataset variable", variable);
    return false;
  }

  // .unit: string | null | undefined
  if (typeof external.unit !== "string" && external.unit !== null && external.unit !== undefined) {
    console.warn("Type guard: 'unit' in external dataset variable", variable);
    return false;
  }

  // .name: non-empty string
  const name = external.name;
  if (typeof name !== "string" || name.trim() === "") {
    console.warn("Type guard: 'name' in external dataset variable", variable);
    return false;
  }

  // .template: boolean | undefined
  if (external.template !== undefined && typeof external.template !== "boolean") {
    console.warn("Type guard: 'template' in external dataset variable", variable);
    return false;
  }

  if (Object.keys(external).some(key => !allowedProps.includes(key))) {
    console.warn("Type guard: unknown properties in external dataset variable", variable);
    return false;
  }

  return true;
}

export function isStringifiedExternalSelection(selection: unknown): selection is string {
  if (typeof selection !== "string") {
    return false;
  }

  try {
    const parsed = JSON.parse(selection) as JSONValue;
    return isExternalSelection(parsed);
  }
  catch {
    console.warn("Type guard: selection should be a valid JSON string");
    return false;
  }
}
export function isExternalSelection(selection: JSONValue): selection is ExternalVariable["selection"] {
  if (!Array.isArray(selection)) {
    console.warn("Type guard: selection should be an array", selection);
    return false;
  }

  if (
    selection.some(item => {
      if (!isStandardObject(item)) {
        console.warn("Type guard: selection items should be objects", item);
        return true;
      }
      const selectionItem = item as Record<string, unknown>;

      if (
        !("variableCode" in selectionItem)
        || typeof selectionItem.variableCode !== "string"
        || selectionItem.variableCode.trim() === ""
      ) {
        console.warn("Type guard: 'variableCode' in selection item", item);
        return true;
      }

      if (
        !("valueCodes" in selectionItem)
        || !Array.isArray(selectionItem.valueCodes)
        || selectionItem.valueCodes.some(code => typeof code !== "string" || code.trim() === "")
      ) {
        console.warn("Type guard: 'valueCodes' in selection item", item);
        return true;
      }

      return false;
    })
  ) {
    return false;
  }

  return true;
}

export function isRecipe(recipe: JSONValue): recipe is RecipeShape {
  const allowedProps = ["name", "equation", "variables", "unit", "meta"];

  // Passed as serialized string, try to parse it first
  if (typeof recipe === "string") {
    try {
      const parsed = JSON.parse(recipe) as JSONValue;
      return isRecipe(parsed);
    }
    catch {
      console.warn("Type guard: recipe should be a valid JSON string");
      return false;
    }
  }

  // Truthy basic object
  if (
    !(recipe instanceof Object)
    || Array.isArray(recipe)
    || recipe === null
  ) {
    console.warn("Type guard: recipe should be an object");
    return false;
  }

  // .name: string
  if (
    !("name" in recipe)
    || typeof recipe.name !== "string"
  ) {
    console.warn("Type guard: 'name' in recipe", recipe);
    return false;
  }

  // .equation: string
  if (
    !("equation" in recipe)
    || typeof recipe.equation !== "string"
  ) {
    console.warn("Type guard: 'equation' in recipe", recipe);
    return false;
  }

  // .variables: RecipeVariable[]
  if (
    !("variables" in recipe)
    || !Array.isArray(recipe.variables)
  ) {
    console.warn("Type guard: 'variables' in recipe should be an array", recipe);
    return false;
  }

  // .unit: string | null | undefined
  if (
    "unit" in recipe
    && recipe.unit !== undefined
    && typeof recipe.unit !== "string"
    && recipe.unit !== null
  ) {
    console.warn("Type guard: 'unit' in recipe", recipe);
    return false;
  }

  // .meta: Record<string, JSONValue>
  if (
    !("meta" in recipe)
    || !isStandardObject(recipe.meta)
  ) {
    console.warn("Type guard: 'meta' in recipe", recipe);
    return false;
  }

  const variables = recipe.variables as unknown[];

  // .variables: RecipeVariable[] - check each variable
  if (
    variables.some((value) => {
      if (!isStandardObject(value)) return true; // important: removes `any` -> `JSONValue` unsafe arg

      // Determine variable kind first to avoid logging expected type mismatches
      // from guards that are not relevant for the current variable.
      if (!("type" in value) || typeof value.type !== "string") {
        return true;
      }

      if (value.type === RecipeDataTypes.Scalar) {
        return !isScalarVariable(value);
      }

      if (value.type === RecipeDataTypes.DataSeries) {
        return !isDataSeriesVariable(value);
      }

      if (value.type === RecipeDataTypes.External) {
        return !isExternalVariable(value);
      }

      return true;
    })
  ) {
    console.warn("Type guard: 'variables' in recipe", recipe);
    return false;
  }

  if (Object.keys(recipe).some(key => !allowedProps.includes(key))) {
    console.warn("Type guard: unknown properties in recipe", recipe);
    return false;
  }

  return true;
}

export function isEvalTimeVariable(
  variable: unknown,
  options: { silent?: boolean } = {},
): variable is EvalTimeVariable {
  const warn = (...args: unknown[]) => !!options.silent ? undefined : console.warn(...args);

  if (
    !isStandardObject(variable)
  ) {
    warn(`Type guard: eval time variable should be an object`, variable);
    return false;
  }

  // .id: string
  if (
    !("id" in variable)
    || typeof variable.id !== "string"
    || variable.id.trim() === ""
  ) {
    warn(`Type guard: 'id' in eval time variable`, variable);
    return false;
  }

  // .displayName: string
  if (
    !("displayName" in variable)
    || typeof variable.displayName !== "string"
    || variable.displayName.trim() === ""
  ) {
    warn(`Type guard: 'displayName' in eval time variable`, variable);
    return false;
  }

  // .type: RecipeDataTypes
  if (
    !("value" in variable)
    || !(
      typeof variable.value === "number"
      || variable.value instanceof mathjs.Unit
      || (
        Array.isArray(variable.value)
        && variable.value.every(item => item instanceof mathjs.Unit)
      )
    )
  ) {
    warn(`Type guard: 'value' in eval time variable`, variable);
    return false;
  }

  return true;
}

export function isEvalTimeSeries(variable: unknown, options: { silent?: boolean } = {}): variable is EvalTimeSeries {
  const warn = (...args: unknown[]) => !!options.silent ? undefined : console.warn(...args);

  if (
    !isStandardObject(variable)
  ) {
    warn(`Type guard: eval time series variable should be an object`, variable);
    return false;
  }

  // .id: string
  if (
    !("id" in variable)
    || typeof variable.id !== "string"
    || variable.id.trim() === ""
  ) {
    warn(`Type guard: 'id' in eval time series variable`, variable);
    return false;
  }

  // .displayName: string
  if (
    !("displayName" in variable)
    || typeof variable.displayName !== "string"
    || variable.displayName.trim() === ""
  ) {
    warn(`Type guard: 'displayName' in eval time series variable`, variable);
    return false;
  }

  // .series: DateValuesWithUnit
  if (
    !("series" in variable)
    || !isStandardObject(variable.series)
    || !isDateValuesWithUnit(variable.series)
  ) {
    warn(`Type guard: 'series' in eval time series variable`, variable);
    return false;
  }

  return true;
}

export function isRecipeExtractionOutput(value: unknown): value is RecipeExtractionOutput {
  return (
    Array.isArray(value)
    && value.every(item => isEvalTimeVariable(item) || isEvalTimeSeries(item))
  );
}