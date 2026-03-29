import type { DatasetKeys } from "@/lib/api/utility";
import { ExternalDataset } from "@/lib/api/utility";
import { isStandardObject } from "@/types";
import { isDateValues, typeguardDebug, uuidRegex } from "@/types";
import type { JSONValue } from "@/types";
import mathjs from "@/math";

import { RecipeDataTypes } from "./consts";
import { VectorIndexPickerOptions } from "./consts";
import type { Recipe } from "@/functions/recipe/recipe";
import type {
  EvalTimeVariable,
  DataSeriesVariable,
  ExternalVariable,
  ScalarVariable,
  SerializedRecipeShape,
} from "@/functions/recipe/types";

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

export function isRecipeScalar(variable: JSONValue): variable is ScalarVariable {
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

export function isRecipeDataSeries(variable: JSONValue): variable is DataSeriesVariable {
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

export function isRecipeExternalDataset(variable: JSONValue): variable is ExternalVariable {
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

export function isRecipeExternalDatasetSelection(selection: JSONValue): selection is ExternalVariable["selection"] {
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

export function isRecipe(recipe: unknown): recipe is SerializedRecipeShape {
  const allowedProps = ["name", "equation", "variables", "meta"];

  if (
    !(recipe instanceof Object)
    || Array.isArray(recipe)
    || recipe === null
  ) {
    console.warn("Type guard: recipe should be an object");
    return false;
  }

  // name: string | null | undefined | omitted
  if (
    "name" in recipe
    && (typeof recipe.name !== "string" && recipe.name !== null && recipe.name !== undefined)
  ) {
    console.warn("Type guard: 'name' in recipe", recipe);
    return false;
  }

  // equation: string
  if (
    !("equation" in recipe)
    || typeof recipe.equation !== "string"
  ) {
    console.warn("Type guard: 'equation' in recipe", recipe);
    return false;
  }

  // variables: Record<string, RecipeVariable>
  if (
    !("variables" in recipe)
    || !isStandardObject(recipe.variables)
  ) {
    console.warn("Type guard: 'variables' in recipe should be an object", recipe);
    return false;
  }

  if (
    "meta" in recipe
    && recipe.meta !== undefined
    && recipe.meta !== null
    && typeof recipe.meta !== "string"
    && typeof recipe.meta !== "number"
    && typeof recipe.meta !== "boolean"
    && !isStandardObject(recipe.meta)
    && !Array.isArray(recipe.meta)
  ) {
    console.warn("Type guard: 'meta' in recipe", recipe);
    return false;
  }

  const variables = recipe.variables as Record<string, unknown>;

  if (
    Object.entries(variables).some(([key, value]) => {
      if (key.trim() === "") return true; // key is already string from Object.entries
      if (!isStandardObject(value)) return true; // important: removes `any` -> `JSONValue` unsafe arg
      return !(
        isRecipeScalar(value)
        || isRecipeDataSeries(value)
        || isRecipeExternalDataset(value)
      );
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

export function isEmptyRecipe(recipe: Recipe): boolean {
  return (
    (recipe.name === null || recipe.name === undefined)
    && recipe.equation.trim() === ""
    && Object.keys(recipe.variables).length === 0
  );
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
