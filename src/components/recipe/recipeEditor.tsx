"use client";

import { type DataSeriesArray, type RawRecipe, type Recipe, RecipeVariableType, RawRecipeVariables, RawDataSeriesByLink } from "@/functions/recipe-parser/types";
import type { Goal } from "@/types";
import { createContext, ReactElement, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateRecipe, parseRecipe, recipeFromUnknown } from "@/functions/parseRecipe";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";

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
  initialRecipe,
  children,
}: {
  initialRecipe?: RawRecipe;
  children: React.ReactNode;
}) {
  const [recipe, setRecipe] = useState<RawRecipe | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultingDataSeries, setResultingDataSeries] = useState<DataSeriesArray | null>(null);

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe]);

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

  useEffect(() => {
    if (initialEquation && !recipe) {
      setRecipe({ eq: initialEquation, variables: {} });
    }
  }, [initialEquation]);

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

export function RecipeVariableEditor({
  initialVariables,

  allowAddVariables = false,
  allowDeleteVariables = false,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowValueEditing = true,
}: {
  initialVariables?: Record<string, RawRecipeVariables>;

  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  useEffect(() => {
    if (initialVariables && !recipe) {
      setRecipe({ eq: "", variables: initialVariables });
    }
  }, [initialVariables]);

  const [selectableRoadmaps, setSelectableRoadmaps] = useState<{ id: string; name: string; }[] | null>(null);
  const [roadmap, setRoadmap] = useState<{ id: string; name: string; } | null>(null);

  const [selectableDataSeries, setSelectableDataSeries] = useState<{ id: string; name: string; roadmapId: string; }[] | null>(null);
  const [dataSeries, setDataSeries] = useState<{ id: string; name: string; roadmapId: string; }[] | null>(null);

  // On mount, fetch all roadmaps to select from
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const roadmaps = await clientSafeGetRoadmaps();
        setSelectableRoadmaps(roadmaps.map(roadmap => ({ id: roadmap.id, name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }) })));
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps();
  }, []);

  // On selecting a roadmap, fetch its data series as selectable options
  useEffect(() => {
    if (!roadmap) return;

    async function fetchDataSeries() {
      if (!roadmap?.id) return;
      try {
        const roadmapData = await clientSafeGetOneRoadmap(roadmap?.id);
        if (!roadmapData?.goals) return;

        const goals = roadmapData?.goals;
        const series = goals.filter(g => g.dataSeries).map(goal => {
          if (!goal.dataSeries) return null;
          return {
            id: goal.dataSeries.id,
            name: goal.name,
            roadmapId: roadmap.id,
          }
        });

        setSelectableDataSeries(series.filter(ds => ds !== null) as { id: string; name: string; roadmapId: string; }[]);
      }
      catch (e) {
        console.error("Failed to fetch data series for roadmap", e);
      }
    }

    fetchDataSeries();
  }, [roadmap]);

  return (<>
    <div className="margin-inline-auto width-100">
      {t("components:copy_and_scale.recipe_variables")}
      <ul className="list-style-none padding-0">
        {Object.entries(recipe?.variables || []).map(([name, variable], i) => (
          <li key={i} className="display-flex align-items-center gap-50 margin-block-25">
            {/* Name display */}
            <input
              type="text"
              value={name}
              style={{ width: '15ch' }}
              readOnly={!allowNameEditing}
              disabled={!allowNameEditing}
              onChange={(e) => {
                setRecipe(prev => {
                  if (!prev) return null;
                  const newName = e.target.value;
                  const newVariables = Object.fromEntries(
                    Object.entries(prev.variables).map(([key, value], index) => {
                      if (index === i) {
                        return [newName, value];
                      }
                      return [key, value];
                    })
                  );
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
              defaultValue={variable.type}
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
                      link: null,
                    };
                  }
                  return {
                    ...prev,
                    variables: newVariables
                  };
                });
              }}>
              <option value={RecipeVariableType.DataSeries}>{t("components:copy_and_scale.data_series")}</option>
              <option value={RecipeVariableType.Scalar}>{t("components:copy_and_scale.scalar")}</option>
            </select>

            {/* Data series input */}
            {variable.type === RecipeVariableType.DataSeries && 'link' in variable && (<>
              {/* Roadmap select */}
              <select
                value={roadmap?.id || "none"}
                onChange={e => {
                  const selectedRoadmap = selectableRoadmaps?.find(r => r.id === e.target.value) || null;
                  setRoadmap(selectedRoadmap);
                }}
              >
                <option value={"none"}>{t("components:recipe.select_roadmap")}</option>
                {selectableRoadmaps?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Data series select */}
              {roadmap && selectableDataSeries && (
                <select
                  value={variable.link || "none"}
                  onChange={e => {
                    const selectedDataSeries = selectableDataSeries.find(ds => ds.id === e.target.value) || null;
                    setRecipe(prev => {
                      if (!prev) return null;
                      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
                      newVariables[name] = {
                        ...newVariables[name],
                        link: selectedDataSeries ? selectedDataSeries.id : null,
                      } as RawDataSeriesByLink;
                      return { ...prev, variables: newVariables };
                    });
                  }}
                >
                  <option value="none">{t("components:recipe.select_data_series")}</option>
                  {selectableDataSeries.map(ds => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              )}
            </>)}

            {/* Scalar input */}
            {variable.type === RecipeVariableType.Scalar && (
              <input
                type="text"
                value={variable.value.toString()}
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
                      } else if (e.target.value === "") {
                        newVariables[name] = { ...currentVar, value: 0 };
                      }
                    } else if (currentVar.type === RecipeVariableType.DataSeries && 'link' in currentVar) {
                      newVariables[name] = { ...currentVar, link: e.target.value };
                    }

                    return { ...prev, variables: newVariables };
                  });
                }}
                readOnly={!allowValueEditing}
              />
            )}

            {/* Delete variable */}
            {allowDeleteVariables &&
              <button type="button" className="red" onClick={() => {
                setRecipe(prev => {
                  if (!prev) return null;
                  const newVars = { ...prev.variables };
                  delete newVars[name];
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
          const newVarName = `var${Object.keys(recipe?.variables || []).length + 1}`;
          setRecipe(prev => {
            if (!prev) return null;
            return {
              ...prev,
              variables: {
                ...prev.variables,
                [newVarName]: {
                  type: RecipeVariableType.DataSeries,
                  link: null,
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
      <table style={{
        display: "block",
        width: "100%",
        maxWidth: "60dvw",
        overflowX: "auto",
      }}>
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