import { useMemo } from "react";
import { useRecipe } from "../context/recipeContext.use";
import type { DateValuesWithUnit } from "@/types";
import type { SerializedRecipe } from "@/functions/recipe";

/** 
 * ## What is this?
 * 
 * When giving the context data upwards out of the context provider, this (and formIntegration.tsx}) is the only junction upward.
 */
export function NonFormIntegration({
  UnitSetter,
  RecipeSetter,
  DateValuesSetter,
}: {
  UnitSetter?: (unit: string) => void | undefined;
  RecipeSetter?: (recipe: SerializedRecipe) => void | undefined;
  DateValuesSetter?: (dateValuesWithUnit: DateValuesWithUnit) => void | undefined;
}) {
  const {
    recipe,
    resultingDataSeries,
    resultingUnit,
  } = useRecipe();

  const dateValues: DateValuesWithUnit | undefined = useMemo(() => {
    if (!resultingDataSeries) return undefined;
    return { unit: resultingUnit, dateValues: resultingDataSeries };
  }, [resultingDataSeries, resultingUnit]);

  useMemo(() => {
    if (UnitSetter && resultingUnit) {
      UnitSetter(resultingUnit);
    }
    if (RecipeSetter && recipe) {
      RecipeSetter(recipe.serialize());
    }
    if (DateValuesSetter && dateValues) {
      DateValuesSetter(dateValues);
    }
  }, [UnitSetter, resultingUnit, RecipeSetter, recipe, DateValuesSetter, dateValues]);

  // This component is only for side effects. It doesn't render anything.
  return null;
}