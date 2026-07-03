import { useEffect } from "react";
import { useRecipe } from "../context/recipeContext.use";

/**
 * Lifts the recipe context's evaluation `error` into a parent form state so the
 * form can block submission of a recipe that fails to evaluate (e.g. an external
 * dataset variable with an incomplete selection, which would otherwise only fail
 * server-side with a 500). Renders nothing.
 *
 * Pass `active={false}` for providers that are mounted but not the currently
 * selected input, so an inactive recipe's error doesn't block the form.
 */
export default function RecipeErrorSync({
  setter,
  active = true,
}: {
  setter: (error: string | null) => void;
  active?: boolean;
}) {
  const { error } = useRecipe();

  useEffect(() => {
    if (!active) return;
    setter(error);
  }, [active, error, setter]);

  return null;
}
