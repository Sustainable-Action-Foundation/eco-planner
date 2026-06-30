import { getDefaultSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { RecipeContextProvider, RecipePreview, TemplateEditor } from "@/components/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe";
import type { DBRecipe } from "@/types";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NonFormIntegration } from "@/components/recipe/output/nonFormIntegration";

/**
 * ## Note
 * Not to be used inside a recipe context. It won't break it necessarily but this works at a higher scope than a single recipe.
 */
export function SuggestedRecipesList({
  existingSuggestedRecipes = [],
}: {
  existingSuggestedRecipes?: DBRecipe[];
}): React.ReactElement {
  const { t } = useTranslation("components");

  const [includeDefaults, setIncludeDefaults] = useState<boolean>(true);
  // Ids the user has removed from the list (covers both existing and default recipes).
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  // Id of the recipe currently loaded into the editor, if any.
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const suggestedRecipesWithDbId: { id: string, recipe: Recipe }[] = useMemo(() => [
    ...existingSuggestedRecipes.map((recipe) => ({
      id: recipe.id,
      recipe: Recipe.from(recipe),
    })),
    ...(includeDefaults ? getDefaultSuggestedRecipes(t) : []).map((recipe) => ({
      id: recipe.id,
      recipe: Recipe.from(recipe),
    })),
  ].filter((db) => !deletedIds.has(db.id)), [existingSuggestedRecipes, includeDefaults, deletedIds, t]);

  // Serialized payload consumed by the goal form (read via the hidden input below).
  const serializedSuggestions = useMemo(
    () => JSON.stringify(suggestedRecipesWithDbId.map((db) => db.recipe.serialize())),
    [suggestedRecipesWithDbId],
  );

  // The recipe loaded into the editor context, derived from the selected id.
  const editingRecipe = useMemo<SerializedRecipe | undefined>(
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

  /** 
   * Gets called in the recipe context and updates the current editing recipe to this.
   */
  function recipeSetter(recipe: SerializedRecipe) {
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
    </ul>

    {!!editingId ? (<>
      <p className="font-size-125">
        {t("components:recipe_editor.editing_recipe_named", { name: !!editingRecipe ? Recipe.from(editingRecipe).name : "" })}
      </p>
      <RecipeContextProvider
        // Remount on id change so the editor re-initializes with the selected recipe.
        key={editingId}
        initialRecipe={editingRecipe}
      >
        <NonFormIntegration
          RecipeSetter={ }
        />
        <TemplateEditor />
      </RecipeContextProvider>
    </>
    ) : null}
  </section>);
};
