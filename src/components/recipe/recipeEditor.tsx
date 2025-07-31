"use client";

import { type DataSeriesArray, type RawRecipe, type Recipe, RecipeVariableType } from "@/functions/recipe-parser/types";
import type { Goal } from "@/types";
import { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateRecipe, parseRecipe } from "@/functions/parseRecipe";

type RecipeContextType = {
  recipe: RawRecipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
  warnings: string[];
  error: string | null;
  resultingDataSeries: DataSeriesArray & { unit?: string };
}

export const RecipeContext = createContext<RecipeContextType | null>(null);
export function useRecipe() {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipeContext must be used within a RecipeContextProvider");
  }
  return context;
}

export function RecipeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [recipe, setRecipe] = useState<RawRecipe | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultingDataSeries, setResultingDataSeries] = useState<DataSeriesArray & { unit?: string }>({});

  useEffect(() => {
    if (!recipe) {
      setResultingDataSeries({});
      setError(null);
      setWarnings([]);
      return;
    }

    async function calculate() {
      try {
        const parsedRecipe = await parseRecipe(recipe);
        const currentWarnings: string[] = [];
        const evaluatedRecipe = await evaluateRecipe(parsedRecipe, currentWarnings);
        setResultingDataSeries(evaluatedRecipe);
        setWarnings(currentWarnings);
        setError(null);
      } catch (e: any) {
        setResultingDataSeries({});
        setError(e.message);
        setWarnings([]);
      }
    }
    calculate();
  }, [recipe]);

  return (
    <RecipeContext.Provider value={{ recipe, setRecipe, warnings, error, resultingDataSeries }}>
      {children}
    </RecipeContext.Provider>
  );
}

export function RecipeSuggestions({
  suggestedRecipes,
}: {
  suggestedRecipes: Goal["recipeSuggestions"];
}) {
  const { t } = useTranslation("components");
  const [selectedHash, setSelectedHash] = useState<string>("");

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hash = e.target.value;
    if (hash) {
      setSelectedHash(e.target.value);
    }
  };

  return (<>
    {/* Suggested recipes */}
    {suggestedRecipes.map((recipe, index) => (
      <label key={index} className="block margin-block-50">
        {/* Radio */}
        <input type="radio" name="recipeSuggestion" value={recipe.hash} onChange={handleOnChange} />
        {" "}

        {/* Name */}
        {(recipe.recipe as Recipe).name ?? t("components:copy_and_scale.unnamed_suggestion")}
        {" "}

        {/* Equation */}
        <span style={{ color: "gray" }}>
          {t("components:copy_and_scale.recipe_label")}( {(recipe.recipe as Recipe).eq} )
        </span>
      </label>
    ))}

    {/* Display the variables in case a selection has been made */}
    {selectedHash && <RecipeVariableEditor />}
  </>);
}

export function RecipeEditor() {
  const { t } = useTranslation("components");


}

export function RecipeEquationEditor() {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  return (<>
    <label className="block margin-block-50">
      <span className="block">{t("components:copy_and_scale.custom_recipe")}</span>
      <textarea
        name="recipeString"
        rows={3}
        placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
        className="block width-100"
        value={recipe?.eq}
        onChange={(e) => setRecipe(recipe ? { ...recipe, eq: e.target.value } : null)}
      />
    </label>
  </>)
}

export function RecipeVariableEditor({
  allowAddVariables = false,
  allowDeleteVariables = false,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowValueEditing = true,
}: {
  recipeVars: RawRecipe["variables"];
  setRecipeVars: React.Dispatch<React.SetStateAction<Record<string, RawRecipe["variables"][string]>>>;
  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
}) {
  const { t } = useTranslation("components");
  const { recipe } = useRecipe();

  const variables = recipe?.variables;
  if (!variables) {
    return <>{t("components:copy_and_scale.no_variables_defined")}</>;
  }

  return (<>
    <div className="margin-inline-auto width-100">
      {t("components:copy_and_scale.recipe_variables")}
      <ul className="list-style-none padding-0">
        {Object.entries(variables).map(([name, variable]) => (
          <li key={name} className="display-flex align-items-center gap-50 margin-block-25">
            {/* Name display */}
            <input
              type="text"
              defaultValue={name}
              style={{ width: '15ch' }}
              readOnly={!allowNameEditing}
              disabled={!allowNameEditing}
            />

            {/* Type selection */}
            <select className="flex-grow-1"
              disabled={!allowTypeEditing}
              defaultValue={RecipeVariableType[variable.type]}
              onChange={(e) => {
                const newType = e.target.value as RecipeVariableType;
                setRecipeVars(prev => ({
                  ...prev,
                  [name]: { ...variable, type: RecipeVariableType[newType] }
                }));
              }}>
              <option value={RecipeVariableType.Scalar}>{t("components:copy_and_scale.scalar")}</option>
              <option value={RecipeVariableType.DataSeries}>{t("components:copy_and_scale.data_series")}</option>
            </select>

            {/* Value input */}
            <input
              type="text"
              value={
                variable.type === RecipeVariableType.Scalar ? variable.value :
                  variable.type === RecipeVariableType.DataSeries && 'link' in variable ? `link: ${variable.link}` :
                    'Data Series'
              }
              className="flex-grow-1"
              onChange={(e) => {
                if (variable.type === RecipeVariableType.Scalar) {
                  const newValue = parseFloat(e.target.value);
                  setRecipeVars(prev => ({
                    ...prev,
                    [name]: { ...variable, value: Number.isNaN(newValue) ? 0 : newValue }
                  }));
                }
              }}
              readOnly={variable.type !== RecipeVariableType.Scalar}
            />

            {/* Delete variable */}
            {allowDeleteVariables &&
              <button type="button" className="red" onClick={() => {
                const newVars = { ...variables };
                delete newVars[name];
                setRecipeVars(newVars);
              }}>
                X
              </button>
            }
          </li>
        ))}
      </ul>

      {/* Add variable */}
      {allowAddVariables &&
        <button type="button" onClick={() => {
          const newVarName = `var${Object.keys(recipeVars).length + 1}`;
          setRecipeVars(prev => ({
            ...prev,
            [newVarName]: { type: RecipeVariableType.Scalar, value: 1 }
          }));
        }}>
          {t("components:copy_and_scale.add_variable")}
        </button>
      }
    </div>
  </>);
}

function RecipeErrorAndWarnings() {
  const { t } = useTranslation("components");
  const { error, warnings } = useRecipe();

  return (<>
    {/* Recipe error */}
    {error && (
      <div className="margin-block-100" style={{ color: 'red' }}>
        <strong>{t("components:copy_and_scale.evaluation_error_title")}:</strong>
        <p>{error}</p>
      </div>
    )}

    {/* Recipe warnings */}
    {warnings.length > 0 && (
      <div className="margin-block-100" style={{ color: 'orange' }}>
        <strong>{t("components:copy_and_scale.evaluation_warning_title")}:</strong>
        <ul>
          {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
        </ul>
      </div>
    )}
  </>);
}