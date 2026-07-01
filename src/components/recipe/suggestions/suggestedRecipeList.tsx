import { getDefaultSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { EquationEditor, RecipeContextProvider, RecipePreview } from "@/components/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe";
import type { DBRecipe, Goal } from "@/types";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NonFormIntegration } from "@/components/recipe/output/nonFormIntegration";

/**
 * ## Note
 * Not to be used inside a recipe context. It won't break it necessarily but this works at a higher scope than a single recipe.
 */
export function SuggestedRecipesList({
  currentGoal,
  existingSuggestedRecipes = [],
}: {
  currentGoal: Goal | undefined;
  existingSuggestedRecipes?: DBRecipe[];
}): React.ReactElement {
  const { t } = useTranslation("components");

  const [includeDefaults, setIncludeDefaults] = useState<boolean>(true);
  // Ids the user has removed from the list (covers both existing and default recipes).
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  // Id of the recipe currently loaded into the editor, if any.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Current recipe reported by the editor, if any. Updates on every change in the editor.
  const [editingRecipe, setEditingRecipe] = useState<SerializedRecipe | null>(null);
  // Before posting/putting, this is the array of the created recipes that will be sent
  const [newSuggestedRecipes, setNewSuggestedRecipes] = useState<{ id: string, recipe: Recipe }[]>([]);

  const suggestedRecipesWithDbId: { id: string, recipe: Recipe }[] = useMemo(() => [
    ...existingSuggestedRecipes.map((recipe) => ({
      id: recipe.id,
      recipe: Recipe.from(recipe),
    })),
    ...(includeDefaults ? getDefaultSuggestedRecipes(t) : []).map((recipe) => ({
      id: recipe.id,
      recipe: Recipe.from(recipe),
    })),
    ...newSuggestedRecipes.map((recipe) => ({
      id: recipe.id,
      recipe: recipe.recipe,
    })),
  ].filter((db) => !deletedIds.has(db.id)), [existingSuggestedRecipes, includeDefaults, t, newSuggestedRecipes, deletedIds]);

  // Serialized payload consumed by the goal form (read via the hidden input below).
  const serializedSuggestions = useMemo(
    () => JSON.stringify(suggestedRecipesWithDbId.map((db) => db.recipe.serialize())),
    [suggestedRecipesWithDbId],
  );

  // The recipe loaded into the editor context, derived from the selected id.
  const initialEditingRecipe = useMemo<SerializedRecipe | undefined>(
    () => suggestedRecipesWithDbId.find((db) => db.id === editingId)?.recipe.serialize(),
    [suggestedRecipesWithDbId, editingId],
  );

  function deleteRecipe(id: string) {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function commitEditingRecipe() {
    if (!editingId || !editingRecipe) return;
    setEditingId(null);
    setEditingRecipe(null);

    setNewSuggestedRecipes((prev) => {
      const next = [...prev];
      const index = next.findIndex((db) => db.id === editingId);
      if (index !== -1) {
        next[index] = { id: editingId, recipe: Recipe.from(editingRecipe) };
      }
      return next;
    });
  }

  return (<section>
    <input type="hidden" name="recipe-suggestions" value={serializedSuggestions} />

    <label className="margin-block-100">
      {/* Include default suggested */}
      {t("components:recipe_editor.include_default_suggested_recipes")}
      <input
        type="checkbox"
        checked={includeDefaults}
        onChange={(event) => setIncludeDefaults(event.target.checked)}
      />
    </label>

    <ul
      style={{
        listStyle: "none",
        padding: "0.5rem",
        paddingBottom: "4rem",
        margin: 0,
        backgroundColor: "var(--gray-95)",
        border: " 1px solid var(--gray-80)",
        borderRadius: "4px",
      }}
      className="secondary-neutral-background"
    >
      {suggestedRecipesWithDbId.map((db) => (
        <li
          key={db.id}
          style={{
            backgroundColor: "var(--gray-90)",
            padding: "0.5rem",
            paddingInline: "1rem",
            paddingBottom: "1rem",
            marginBottom: "0.5rem",
            borderRadius: "4px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {db.recipe.name}

            <div>
              {/* Delete */}
              <button
                type="button"
                onClick={() => deleteRecipe(db.id)}
              >
                🗑️
              </button>

              {/* Edit */}
              <button
                type="button"
                onClick={() => setEditingId(db.id)}
              >
                ✏️
              </button>
            </div>
          </div>

          <hr className="margin-50" style={{ color: 'var(--gray-80)', borderBottom: '0', borderStyle: 'solid' }} />

          {/* Body - Recipe preview */}
          <div>
            <RecipePreview recipe={db.recipe} />
          </div>
        </li>
      ))}
      {suggestedRecipesWithDbId.length === 0 && (
        <li className="width-100 text-align-center">
          {t("components:recipe_editor.no_suggested_recipes")}
        </li>
      )}
      <li className="width-100 text-align-center">
        <button
          type="button"
          onClick={() => {
            const newId = `new-${newSuggestedRecipes.length}`;
            setNewSuggestedRecipes((prev) => [...prev, {
              id: newId,
              recipe: Recipe.fromDataSeries({
                recipeName: t("components:recipe_editor.new_recipe"),
                dataSeriesName: t("components:recipe_editor.this_data_series"),
                unit: currentGoal?.dataSeries?.unit ?? undefined,
              }),
            }]);
            setEditingId(newId);
          }}
        >
          {t("components:recipe_editor.add_new_recipe")}
          💅
        </button>
      </li>
    </ul>

    {!!editingId ? (<>
      <p className="font-size-125">
        {t("components:recipe_editor.editing_recipe_named", { name: !!initialEditingRecipe ? Recipe.from(initialEditingRecipe).name : "" })}
      </p>
      <RecipeContextProvider
        // Remount on id change so the editor re-initializes with the selected recipe.
        key={editingId}
        initialRecipe={initialEditingRecipe}
      >
        <NonFormIntegration
          RecipeSetter={setEditingRecipe}
        />
        <EquationEditor />
      </RecipeContextProvider>

      <button
        type="button"
        onClick={commitEditingRecipe}
      >
        {t("components:recipe_editor.commit_editing_recipe")}
      </button>
    </>
    ) : null}
  </section>);
};
