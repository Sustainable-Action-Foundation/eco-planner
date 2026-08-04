import { getDefaultSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { EquationEditor, RecipeContextProvider, RecipePreview } from "@/components/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe";
import type { DBRecipe, Goal } from "@/types";
import { GoalFormName } from "@/types/form-names";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import { parseUnit } from "@/functions/unit";

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
  // Editable name of the recipe currently in the editor. Applied on commit.
  const [editingName, setEditingName] = useState<string>("");
  // Whether the recipe in the editor is a freshly-added draft. If so, cancelling
  // removes it entirely rather than just closing the editor.
  const [editingIsNew, setEditingIsNew] = useState<boolean>(false);
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

  /**
   * Commit an edited recipe into the outgoing list, always with a freshly
   * rerolled id. Editing a default or existing (DB) recipe stores the edit as a
   * new local recipe and hides the original; editing an already-local recipe
   * replaces it in place. Returns the rerolled id.
   */
  function upsertEditedRecipe(sourceId: string, recipe: Recipe): string {
    const rerolledId = window.crypto.randomUUID();
    const wasLocal = newSuggestedRecipes.some((db) => db.id === sourceId);

    setNewSuggestedRecipes((prev) => {
      const index = prev.findIndex((db) => db.id === sourceId);
      if (index !== -1) {
        const next = [...prev];
        next[index] = { id: rerolledId, recipe };
        return next;
      }
      return [...prev, { id: rerolledId, recipe }];
    });

    // A default/existing recipe is replaced by its edited copy, so hide the original.
    if (!wasLocal) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(sourceId);
        return next;
      });
    }

    return rerolledId;
  }

  /**
   * Open the editor for a recipe, seeding the editable name field from it.
   * Any in-progress edit of another recipe is committed first so switching
   * between recipes never discards changes.
   */
  function startEditing(id: string, name: string, isNew = false) {
    if (editingId === id) return; // Already editing this one.
    if (editingId && editingRecipe) commitEditingRecipe();
    setEditingId(id);
    setEditingName(name);
    setEditingIsNew(isNew);
  }

  /** Close the editor and clear the editing state, without committing. */
  function closeEditor() {
    setEditingId(null);
    setEditingRecipe(null);
    setEditingName("");
    setEditingIsNew(false);
  }

  function commitEditingRecipe() {
    if (!editingId || !editingRecipe) return;
    const recipe = Recipe.from(editingRecipe);
    recipe.name = editingName;
    upsertEditedRecipe(editingId, recipe);
    closeEditor();
  }

  /**
   * Discard the in-progress edit. Existing/default recipes are only mutated on
   * commit, so cancelling just closes the editor; a freshly-added draft never
   * committed is removed from the list entirely.
   */
  function cancelEditingRecipe() {
    if (editingIsNew && editingId) {
      const draftId = editingId;
      setNewSuggestedRecipes((prev) => prev.filter((db) => db.id !== draftId));
    }
    closeEditor();
  }

  return (<section>
    <input type="hidden" name={GoalFormName.RecipeSuggestions} value={serializedSuggestions} />

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
            <span style={{ fontWeight: "bold" }}>
              {db.recipe.name}
            </span>

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
                onClick={() => startEditing(db.id, db.recipe.name)}
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
            const newId = window.crypto.randomUUID();
            const newRecipe = Recipe.fromDataSeries({
              recipeName: t("components:recipe_editor.new_recipe"),
              dataSeriesName: currentGoal?.name || t("components:recipe_editor.this_data_series"),
              unit: parseUnit(currentGoal?.data_series?.unit),
            });
            setNewSuggestedRecipes((prev) => [...prev, { id: newId, recipe: newRecipe }]);
            startEditing(newId, newRecipe.name, true);
          }}
        >
          {t("components:recipe_editor.add_new_recipe")}
          💅
        </button>
      </li>
    </ul>

    {editingId ? (<>
      <p className="font-size-125">
        {t("components:recipe_editor.editing_recipe_named", { name: initialEditingRecipe ? Recipe.from(initialEditingRecipe).name : "" })}
      </p>

      <label className="margin-block-100 display-flex flex-direction-column">
        {t("components:recipe_editor.recipe_name")}
        <input
          type="text"
          value={editingName}
          onChange={(event) => setEditingName(event.target.value)}
          style={{ fontWeight: "bold" }}
        />
      </label>

      <RecipeContextProvider
        // Remount on id change so the editor re-initializes with the selected recipe.
        key={editingId}
        initialRecipe={initialEditingRecipe}
      >
        <RecipeSync
          onRecipe={setEditingRecipe}
        />
        <EquationEditor />
      </RecipeContextProvider>

      {/* Commit */}
      <button
        type="button"
        onClick={commitEditingRecipe}
      >
        {t("components:recipe_editor.commit_editing_recipe")}
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={cancelEditingRecipe}
      >
        {t("components:recipe_editor.cancel_editing_recipe")}
      </button>
    </>
    ) : null}
  </section>);
};
