import { useEffect } from "react";
import { useRecipe } from "../context/recipeContext.use";

/**
 * Auto-syncs the recipe's evaluated unit into the parent form's unit field.
 * Fires only when `resultingUnit` actually changes, so a user's later manual
 * edit isn't clobbered on every re-render. Renders nothing.
 */
export default function UnitSync({
  setter,
}: {
  setter: React.Dispatch<React.SetStateAction<string>>
}) {
  const { resultingUnit } = useRecipe();

  useEffect(() => {
    if (!resultingUnit) return;
    setter(resultingUnit);
  }, [resultingUnit, setter]);

  return null;
}