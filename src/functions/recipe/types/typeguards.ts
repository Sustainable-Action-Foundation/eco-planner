import { DatasetKeys, ExternalDataset } from "@/lib/api/utility";
import { isStandardObject } from "@/types";
import { isDateValues, typeguardDebug, uuidRegex } from "@/types";
import type { JSONValue } from "@/types";
import mathjs from "@/math";

import { RecipeDataTypes } from "./consts";
import { VectorIndexPickerOptions } from "./consts";
import type { SmartRecipe } from "@/functions/recipe/smartRecipe";
import type {
  EvalTimeVariable,
  Recipe,
  RecipeDataSeries,
  RecipeExternalDataset,
  RecipeScalar,
} from "./types";

export function isRecipeDataType(variable: unknown): variable is (typeof RecipeDataTypes)[keyof typeof RecipeDataTypes] {
  return (
    typeof variable === "string" &&
    (
      variable === RecipeDataTypes.Scalar ||
      variable === RecipeDataTypes.DataSeries ||
      variable === RecipeDataTypes.External
    )
  );
}

export function isRecipeScalar(variable: JSONValue): variable is RecipeScalar {
  const allowedProps = ["type", "value", "unit"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: scalar variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.Scalar
    ) &&

    (
      typeof variable.value === "number" ||
      typeguardDebug("Type guard: 'value' in scalar variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null ||
      typeguardDebug("Type guard: 'unit' in scalar variable") && false
    ) &&

    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in scalar variable") && false
    )
  );
}

export function isRecipeDataSeries(variable: JSONValue): variable is RecipeDataSeries {
  const allowedProps = ["type", "link", "pick", "unit", "value", "goalName", "disabled"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: data series variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.DataSeries
    ) &&

    (
      (typeof variable.link === "string" && uuidRegex.test(variable.link)) ||
      variable.link == null ||
      typeguardDebug("Type guard: 'link' in data series variable") && false
    ) &&

    (
      (
        typeof variable.pick === "string"
        && Object.values(VectorIndexPickerOptions).includes(variable.pick as (typeof VectorIndexPickerOptions)[keyof typeof VectorIndexPickerOptions])
      )
      || (
        typeof variable.pick === "number"
        && Number.isInteger(variable.pick)
      )
      || typeguardDebug("Type guard: 'pick' in data series variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null ||
      typeguardDebug("Type guard: 'unit' in data series variable") && false
    ) &&

    (
      variable.value === undefined ||
      variable.value === null ||
      isDateValues(variable.value)
    ) &&

    (
      variable.goalName === undefined ||
      (
        typeof variable.goalName === "string" &&
        variable.goalName.trim() !== ""
      )
    ) &&

    (
      variable.disabled === undefined ||
      typeof variable.disabled === "boolean"
    ) &&

    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in data series variable") && false
    )
  )
}

export function isRecipeExternalDataset(variable: JSONValue): variable is RecipeExternalDataset {
  const allowedProps = ["type", "dataset", "tableId", "selection", "pick", "unit"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: external dataset variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.External
    ) &&

    (
      typeof variable.dataset === "string" &&
      ExternalDataset.knownDatasetKeys.includes(variable.dataset as DatasetKeys) ||
      variable.dataset == null ||
      typeguardDebug("Type guard: 'dataset' in external dataset variable") && false
    ) &&

    (
      typeof variable.tableId === "string" &&
      variable.tableId.trim() !== "" ||
      variable.tableId == null ||
      typeguardDebug("Type guard: 'tableId' in external dataset variable") && false
    ) &&

    (
      isRecipeExternalDatasetSelection(variable.selection ?? null) ||
      typeguardDebug("Type guard: 'selection' in external dataset variable") && false
    ) &&

    (
      (
        typeof variable.pick === "string"
        && Object.values(VectorIndexPickerOptions).includes(variable.pick as (typeof VectorIndexPickerOptions)[keyof typeof VectorIndexPickerOptions])
      )
      || (
        typeof variable.pick === "number"
        && Number.isInteger(variable.pick)
      )
      || typeguardDebug("Type guard: 'pick' in external dataset variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null ||
      typeguardDebug("Type guard: 'unit' in external dataset variable") && false
    ) &&

    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in external dataset variable") && false
    )
  );
}

export function isRecipeExternalDatasetSelection(selection: JSONValue): selection is RecipeExternalDataset["selection"] {
  return (
    Array.isArray(selection) &&
    selection.every(item => (
      (
        item instanceof Object &&
        !Array.isArray(item) &&
        item != null ||
        typeguardDebug("Type guard: selection items should be objects") && false
      ) &&

      (
        "variableCode" in item &&
        typeof item.variableCode === "string" &&
        item.variableCode.trim() !== "" ||
        typeguardDebug("Type guard: 'variableCode' in selection item") && false
      ) &&

      (
        "valueCodes" in item &&
        Array.isArray(item.valueCodes) &&
        item.valueCodes.every(code => typeof code === "string" && code.trim() !== "") ||
        typeguardDebug("Type guard: 'valueCodes' in selection item") && false
      )
    ))
  );
}

export function isRecipe(recipe: JSONValue): recipe is Recipe {
  const allowedProps = ["name", "eq", "variables", "smartMeta"];

  return (
    (
      recipe instanceof Object &&
      !Array.isArray(recipe) &&
      recipe != null ||
      typeguardDebug("Type guard: recipe should be an object") && false
    ) &&

    (
      typeof recipe.name === "string" ||
      recipe.name == null ||
      typeguardDebug("Type guard: 'name' in recipe") && false
    ) &&

    (
      typeof recipe.eq === "string" ||
      typeguardDebug("Type guard: 'eq' in recipe") && false
    ) &&

    (
      recipe.smartMeta === undefined ||
      typeof recipe.smartMeta === "string"
    ) &&

    (
      isStandardObject(recipe.variables) &&
      Object.entries(recipe.variables).every(([key, value]) => (
        typeof key === "string" &&
        key.trim() !== "" &&
        (
          isRecipeScalar(value ?? null) ||
          isRecipeDataSeries(value ?? null) ||
          isRecipeExternalDataset(value ?? null)
        )
      )) ||
      typeguardDebug("Type guard: 'variables' in recipe") && false
    ) &&

    (
      Object.keys(recipe).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in recipe") && false
    )
  );
}

export function isEmptyRecipe(recipe: Recipe): boolean {
  return (
    (recipe.name === null || recipe.name === undefined) &&
    recipe.eq.trim() === "" &&
    Object.keys(recipe.variables).length === 0
  );
}

export function isSmartRecipe(recipe: unknown): recipe is SmartRecipe {
  if (typeof recipe !== "object" || recipe === null) return false;

  if (!("equation" in recipe) || typeof recipe["equation"] !== "string") return false;
  if (!("checkValidity" in recipe) || typeof recipe["checkValidity"] !== "function") return false;

  return true;
}

export function isEvalTimeVariable(variable: unknown): variable is EvalTimeVariable {
  if (
    !isStandardObject(variable)
  ) {
    console.warn(`Type guard: eval time variable should be an object`);
    return false;
  }

  if (
    !("name" in variable)
    || typeof variable.name !== "string"
    || variable.name.trim() === ""
  ) {
    console.warn(`Type guard: 'name' in eval time variable`);
    return false;
  }

  if (
    !("value" in variable)
    || !(
      typeof variable.value === "number"
      || variable.value instanceof mathjs.Unit
      || (
        Array.isArray(variable.value)
        && variable.value.every(item => item instanceof mathjs.Unit)
      )
    )) {
    console.warn(`Type guard: 'value' in eval time variable`);
    return false;
  }

  return true;
}
