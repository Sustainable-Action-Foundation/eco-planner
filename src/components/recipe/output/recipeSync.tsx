import { useEffect, useMemo } from "react";
import { useRecipe } from "../context/recipeContext.use";
import type { DateValuesWithUnit } from "@/types";
import type { SerializedRecipe } from "@/functions/recipe";
import { isUnitFlag } from "@/functions/unit";

/**
 * Lifts recipe context state up to a parent via optional setters. This is the one
 * junction for reading context data from *outside* the provider as React state —
 * the sibling of {@link FormIntegration}, which writes the same data into hidden
 * `<input>`s for native form submission instead.
 *
 * Supersedes the former one-off `UnitSync`, `RecipeErrorSync`, and
 * `NonFormIntegration` components, whose jobs were the same effect-based lift of a
 * single field.
 *
 * Each callback fires as a side effect (never during render) when its value
 * changes. `onUnit` / `onRecipe` / `onDateValues` fire only when a value is
 * actually available, so a still-evaluating or empty recipe never clobbers a
 * parent field; `onError` fires with the current value, including `null`.
 *
 * Pass `active={false}` for a provider that is mounted but not the currently
 * selected input — it suppresses every callback so a hidden recipe can't overwrite
 * the parent's fields (e.g. two data-series-type providers sharing one unit field).
 *
 * Renders nothing.
 */
export function RecipeSync({
  onUnit,
  onRecipe,
  onDateValues,
  onError,
  active = true,
}: {
  onUnit?: (unit: string) => void;
  onRecipe?: (recipe: SerializedRecipe) => void;
  onDateValues?: (dateValues: DateValuesWithUnit | null) => void;
  onError?: (error: string | null) => void;
  active?: boolean;
}) {
  const { recipe, resultingDataSeries, resultingUnit, error, isEvaluationPending } = useRecipe();

  // undefined = still catching up (debounce/in-flight eval), don't touch the parent yet.
  // null      = evaluation settled and there's genuinely nothing — tell the parent to clear.
  // object    = evaluation settled with data and/or a unit to show.
  const dateValues: DateValuesWithUnit | null | undefined = useMemo(() => {
    if (isEvaluationPending) return undefined;
    if (!resultingDataSeries && isUnitFlag(resultingUnit)) return null;
    return { unit: resultingUnit, dateValues: resultingDataSeries ?? {} };
  }, [isEvaluationPending, resultingDataSeries, resultingUnit]);

  useEffect(() => {
    if (!active) return;
    if (onUnit && !isUnitFlag(resultingUnit)) onUnit(resultingUnit);
    if (onRecipe && recipe) onRecipe(recipe.serialize());
    if (onDateValues && dateValues !== undefined) onDateValues(dateValues);
    if (onError) onError(error);
  }, [active, onUnit, resultingUnit, onRecipe, recipe, onDateValues, dateValues, onError, error]);

  return null;
}
