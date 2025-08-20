"use client";

import { emptyRecipe, emptyRecipeDataTypes, isRecipe, Recipe, RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import type { DataSeriesValueFields } from "@/types";
import { createContext, ReactElement, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateRecipe, cleanRecipe, recipeFromUnknown } from "@/functions/parseRecipe";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import { DataSeriesVariable, ExternalVariable, ScalarVariable } from "./variables";

type RecipeContextType = {
  recipe: Recipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>;
  warnings: string[];
  error: string | null;
  resultingDataSeries: Partial<DataSeriesValueFields> | null;
  resultingUnit: string | null | undefined;
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
  initialRecipe?: Recipe;
  children: React.ReactNode;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultingDataSeries, setResultingDataSeries] = useState<Partial<DataSeriesValueFields> | null>(null);
  const [resultingUnit, setResultingUnit] = useState<string | null | undefined>(null);

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe]);

  useEffect(() => {
    if (!recipe) {
      setResultingDataSeries(null);
      setResultingUnit(null);
      setError(null);
      setWarnings([]);
      return;
    }

    async function calculate() {
      try {
        const currentWarnings: string[] = [];
        const evaluatedRecipe = await evaluateRecipe(cleanRecipe(recipe), currentWarnings);
        setResultingDataSeries(evaluatedRecipe.dataSeries);
        setResultingUnit(evaluatedRecipe.unit)
        setWarnings(currentWarnings);
        setError(null);
      } catch (e: unknown) {
        setResultingDataSeries(null);
        setError((e as Error)?.message);
        setWarnings([]);
      }
    }
    calculate().catch(e => { throw e; });
  }, [recipe]);

  return (
    <RecipeContext.Provider value={{ recipe, setRecipe, warnings, error, resultingDataSeries, resultingUnit }}>
      {children}
    </RecipeContext.Provider>
  );
}

export function RecipeSuggestions({
  suggestedRecipes,
}: {
  // TODO - only use prisma generated and type guard the recipe prop into, not `JsonValue`
  suggestedRecipes: { hash: string, recipe: Recipe }[];
}) {
  const { t } = useTranslation("components");
  const { setRecipe } = useRecipe();

  for (const recipe of suggestedRecipes) {
    if (!isRecipe(recipe.recipe)) {
      console.warn("Invalid recipe in suggestions", recipe);
      return null;
    }
  }
  // Validate suggested recipes
  if (suggestedRecipes.some(r => !isRecipe(r.recipe))) {
    console.warn("Some suggested recipes are not valid. Please check the data.");
    return null;
  }

  // On change set the context state to the selected recipe
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        <input type="radio" name="recipeSuggestion" value={recipe.hash} onChange={handleChange} />
        {" "}

        {/* Name */}
        {recipe.recipe.name ?? t("components:copy_and_scale.unnamed_suggestion")}
        {" "}

        {/* Equation */}
        <span style={{ color: "gray" }}>
          {t("components:copy_and_scale.recipe_label")}( {recipe.recipe.eq} )
        </span>
      </label>
    ))}
  </>);
}

export function RecipeEquationEditor() {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const handleUpdatedEq = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const eq = e.target.value;
    if (!recipe) {
      console.warn("No recipe set, initializing with new one form the RecipeEquationEditor component");
      setRecipe({ ...emptyRecipe, eq });
    }
    else {
      setRecipe({ ...recipe, eq });
    }
  };

  return (<>
    <label className="block margin-block-50">
      <span className="block">{t("components:copy_and_scale.custom_recipe")}</span>
      <textarea
        rows={3}
        placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
        className="block width-100"
        value={recipe?.eq || ""}
        onChange={handleUpdatedEq}
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
  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[] | null>(null);
  const [selectedRoadmaps, setSelectedRoadmaps] = useState<string[]>([]);
  const [availableDataSeries, setAvailableDataSeries] = useState<{ id: string; name: string; roadmapId: string; }[] | null>(null);

  // On mount, fetch all roadmaps user has access to
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const roadmaps = await clientSafeGetRoadmaps();
        setAvailableRoadmaps(roadmaps.map(roadmap => ({ id: roadmap.id, name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }) })));
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps().catch(e => { throw e; });
  }, [t]);

  // On selecting a roadmap, fetch its data series as selectable options
  useEffect(() => {
    if (!recipe || !recipe.variables) return;

    if (selectedRoadmaps.length === 0) {
      return;
    }

    async function fetchOneDataSeries(roadmapId: string) {
      try {
        const roadmapData = await clientSafeGetOneRoadmap(roadmapId);
        if (!roadmapData?.goals) return;

        const goals = roadmapData?.goals;
        if (!goals || !Array.isArray(goals) || goals.length === 0) {
          console.warn("No goals found in roadmap", roadmapId);
          return;
        }

        const series = goals.filter(g => g.dataSeries).map(goal => {
          if (!goal.dataSeries) return null;
          return {
            id: goal.dataSeries.id,
            name: goal.name,
            roadmapId: roadmapId,
            ...(goal.dataSeries.unit ? { unit: goal.dataSeries.unit } : {})
          }
        });
        if (series.length === 0) {
          console.warn("No data series found in roadmap", roadmapId);
          return;
        }

        const dataSeriesFound = Object.fromEntries(series
          .filter(ds => ds !== null)
          .map(ds => ([ds.id, ds])));

        setAvailableDataSeries(prev => {
          const existingDataSeries = prev ? Object.fromEntries(prev.map(ds => ([ds.id, ds]))) : {};
          return Object.values({ ...existingDataSeries, ...dataSeriesFound }) as { id: string; name: string; roadmapId: string; unit?: string; }[];
        });
      }
      catch (e) {
        console.error("Failed to fetch data series for roadmap", e);
      }
    }

    async function fetchAllDataSeries() {
      if (!selectedRoadmaps || selectedRoadmaps.length === 0) return;

      setAvailableDataSeries(null);

      for (const roadmapId of selectedRoadmaps) {
        await fetchOneDataSeries(roadmapId);
      }
    }

    fetchAllDataSeries().catch(e => { throw e; });

  }, [recipe, selectedRoadmaps]);


  // Hard coded to make a new data series variable. TODO: reconsider this behavior
  const handleAddVariable = () => {
    const newVarName = `var${Object.keys(recipe?.variables || []).length + 1}`;
    setRecipe(prev => {
      prev = prev || emptyRecipe;
      return {
        ...prev,
        variables: {
          ...prev.variables,
          [newVarName]: emptyRecipeDataTypes[RecipeDataTypes.DataSeries],
        }
      }
    });
  };

  return (<>
    <div className="margin-inline-auto width-100">
      {t("components:copy_and_scale.recipe_variables")}
      <ul className="list-style-none padding-0" style={{
        display: 'flex',
        flexFlow: 'column nowrap',
        rowGap: '1ch',
      }}>
        {Object.entries(recipe?.variables || []).map(([name, variable], i) => {
          const rules = {
            allowAddVariables,
            allowDeleteVariables,
            allowNameEditing,
            allowTypeEditing,
            allowValueEditing,
          };
          switch (variable.type) {
            case RecipeDataTypes.Scalar:
              return <ScalarVariable
                key={i}
                name={name}
                rules={rules}
              />
            case RecipeDataTypes.DataSeries:
              return <DataSeriesVariable
                key={i}
                name={name}
                rules={rules}
                availableRoadmaps={availableRoadmaps || []}
                availableDataSeries={availableDataSeries || []}
                setSelectedRoadmaps={setSelectedRoadmaps}
              />
            case RecipeDataTypes.External:
              return <ExternalVariable
                key={i}
                name={name}
                rules={rules}
              />
            default:
              variable = variable as RecipeVariables;
              console.warn("Unknown variable type", variable.type, "for variable", name);
          }
        })}
      </ul>

      {/* Add variable */}
      {allowAddVariables &&
        <button type="button" onClick={handleAddVariable}>
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

// TODO: remove this once things work
export function DEBUG_Recipe() {
  return <pre>
    {JSON.stringify(useRecipe(), null, 2)}
  </pre>
}


/* 
 * Form interacting components
 */
export function ResultingDataSeries({ FormElement }: { FormElement?: ReactElement }) {
  const { t } = useTranslation("components");
  const { resultingDataSeries, resultingUnit } = useRecipe();

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
        {resultingUnit ? ` (${resultingUnit})` : ""}
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
            {Object.keys(resultingDataSeries).map((year, i) => (
              <th className="padding-50 text-align-center" key={i + "resulting-data-series-header" + year}>{year.replace("val", "")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="padding-50 text-align-center">{t("components:copy_and_scale.data_series_value")}</td>
            {Object.values(resultingDataSeries).map((value, i) => (
              <td className="padding-50 text-align-center" key={i + "resulting-data-series-value" + String(value)}>{(value as number)?.toFixed(1) || "-"}</td>
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