"use client";

import { type DataSeriesArray, type RawRecipe, type Recipe, RecipeVariableType, RawRecipeVariables } from "@/functions/recipe-parser/types";
import type { Goal } from "@/types";
import { createContext, ReactElement, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateRecipe, parseRecipe, recipeFromUnknown } from "@/functions/parseRecipe";

type RecipeContextType = {
  recipe: RawRecipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
  warnings: string[];
  error: string | null;
  resultingDataSeries: DataSeriesArray | null;
}

export const RecipeContext = createContext<RecipeContextType | null>(null);
export function useRecipe() {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within a RecipeContextProvider");
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
  const [resultingDataSeries, setResultingDataSeries] = useState<DataSeriesArray | null>(null);

  useEffect(() => {
    if (!recipe) {
      setResultingDataSeries(null);
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
      } catch (e: unknown) {
        setResultingDataSeries(null);
        setError((e as Error).message);
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
  const { setRecipe } = useRecipe();

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hash = e.target.value;
    const selectedSuggestion = suggestedRecipes.find(r => r.hash === hash);
    if (selectedSuggestion) {
      try {
        const rawRecipe = recipeFromUnknown(selectedSuggestion.recipe);
        setRecipe(rawRecipe);
      } catch (e) {
        console.error("Failed to parse suggested recipe", e);
        setRecipe(null);
      }
    } else {
      setRecipe(null);
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
  </>);
}



export function RecipeEquationEditor({
  initialEquation,
}: {
  initialEquation?: string;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  if (!recipe) {
    setRecipe({ eq: initialEquation || "", variables: {} });
  }

  return (<>
    <label className="block margin-block-50">
      <span className="block">{t("components:copy_and_scale.custom_recipe")}</span>
      <textarea
        name="recipeString"
        rows={3}
        placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
        className="block width-100"
        value={recipe?.eq ?? ""}
        onChange={(e) => setRecipe(recipe ? { ...recipe, eq: e.target.value } : { eq: e.target.value, variables: {} })}
      />
    </label>
  </>)
}

export function DEBUG_RecipeOutput() {
  const { recipe } = useRecipe();
  return JSON.stringify(recipe, null, 2) || "No recipe set";
}

export function RecipeVariableEditor({
  allowAddVariables = false,
  allowDeleteVariables = false,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowValueEditing = true,
}: {
  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const variables = recipe?.variables;
  if (!variables && !allowAddVariables) {
    return null;
  }

  return (<>
    <div className="margin-inline-auto width-100">
      {t("components:copy_and_scale.recipe_variables")}
      <ul className="list-style-none padding-0">
        {Object.entries(variables || []).map(([name, variable]) => (
          <li key={name} className="display-flex align-items-center gap-50 margin-block-25">
            {/* Name display */}
            <input
              type="text"
              defaultValue={name}
              style={{ width: '15ch' }}
              readOnly={!allowNameEditing}
              disabled={!allowNameEditing}
              onChange={(e) => {
                setRecipe(prev => {
                  if (!prev) return null;
                  const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
                  if (e.target.value !== name) {
                    newVariables[e.target.value] = { ...newVariables[name] };
                    delete newVariables[name];
                  }
                  return {
                    ...prev,
                    variables: newVariables,
                  };
                });
              }}
            />

            {/* Type selection */}
            <select className="flex-grow-1"
              disabled={!allowTypeEditing}
              value={variable.type}
              onChange={(e) => {
                const newType = e.target.value as RecipeVariableType;
                setRecipe(prev => {
                  if (!prev) return null;
                  const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };

                  if (newType === RecipeVariableType.Scalar) {
                    newVariables[name] = {
                      type: RecipeVariableType.Scalar,
                      value: 1
                    };
                  } else if (newType === RecipeVariableType.DataSeries) {
                    newVariables[name] = {
                      type: RecipeVariableType.DataSeries,
                      link: "goal://"
                    };
                  }
                  return {
                    ...prev,
                    variables: newVariables
                  };
                });
              }}>
              <option value={RecipeVariableType.Scalar}>{t("components:copy_and_scale.scalar")}</option>
              <option value={RecipeVariableType.DataSeries}>{t("components:copy_and_scale.data_series")}</option>
            </select>

            {/* Value input */}
            <input
              type="text"
              value={
                variable.type === RecipeVariableType.Scalar ? variable.value :
                  variable.type === RecipeVariableType.DataSeries && 'link' in variable ? variable.link :
                    'Data Series'
              }
              disabled={!allowValueEditing}
              className="flex-grow-1"
              onChange={(e) => {
                setRecipe(prev => {
                  if (!prev) return null;
                  const currentVar = prev.variables[name];
                  const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };

                  if (currentVar.type === RecipeVariableType.Scalar) {
                    const newValue = parseFloat(e.target.value);
                    if (!isNaN(newValue)) {
                      newVariables[name] = { ...currentVar, value: newValue };
                    }
                  } else if (currentVar.type === RecipeVariableType.DataSeries && 'link' in currentVar) {
                    newVariables[name] = { ...currentVar, link: e.target.value };
                  }

                  return { ...prev, variables: newVariables };
                });
              }}
              readOnly={variable.type !== RecipeVariableType.Scalar && (variable.type !== RecipeVariableType.DataSeries || !('link' in variable))}
            />

            {/* Delete variable */}
            {allowDeleteVariables &&
              <button type="button" className="red" onClick={() => {
                const newVars = { ...variables };
                delete newVars[name];
                setRecipe(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    variables: newVars
                  }
                });
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
          const newVarName = `var${Object.keys(variables || []).length + 1}`;
          setRecipe(prev => {
            if (!prev) return null;
            return {
              ...prev,
              variables: {
                ...prev.variables,
                [newVarName]: {
                  type: RecipeVariableType.Scalar,
                  value: 1
                }
              }
            }
          });
        }}>
          {t("components:copy_and_scale.add_variable")}
        </button>
      }
    </div>
  </>);
}

export function RecipeErrorAndWarnings() {
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


/* 
 * Form interacting components
 */
export function ResultingDataSeries({ FormElement }: { FormElement?: ReactElement }) {
  const { t } = useTranslation("components");
  const { resultingDataSeries } = useRecipe();

  const data = resultingDataSeries ? Object.fromEntries(Object.entries(resultingDataSeries).filter(([key]) => key !== 'unit')) : {};

  if (!resultingDataSeries) {
    return null;
  }

  return (
    <div className="margin-inline-auto width-100">
      {/* Hidden input for reading into the form */}
      {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(resultingDataSeries)} />}

      {/* Title */}
      <strong className="block bold text-align-center">
        {t("components:copy_and_scale.resulting_data_series")}
        {/* Unit */}
        {resultingDataSeries?.unit ? ` (${resultingDataSeries.unit})` : ""}
      </strong>

      {/* Table to display resulting data series */}
      <table className="margin-block-100 block width-100 overflow-x-scroll">
        <thead>
          <tr>
            <th className="padding-50 text-align-center">{t("components:copy_and_scale.data_series_year")}</th>
            {Object.keys(data).map((year, i) => (
              <th className="padding-50 text-align-center" key={i + "resulting-data-series-header" + year}>{year.replace("val", "")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="padding-50 text-align-center">{t("components:copy_and_scale.data_series_value")}</td>
            {Object.values(data).map((value, i) => (
              <td className="padding-50 text-align-center" key={i + "resulting-data-series-value" + value}>{(value as number)?.toFixed(1) || "-"}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ResultingRecipe({ FormElement }: { FormElement?: ReactElement }) {
  const { recipe } = useRecipe();

  return (<>
    {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(recipe)} />}
  </>);
}