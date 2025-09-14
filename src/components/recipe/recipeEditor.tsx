"use client";

import { emptyRecipe, emptyRecipeDataTypes, Recipe, RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import type { DataSeriesValueFields } from "@/types";
import { createContext, ReactElement, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateRecipe, cleanRecipe } from "@/functions/parseRecipe";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import { DataSeriesVariable, ExternalVariable, ScalarVariable } from "./variables";
import { Locales } from "i18n.config";
import { Popover, PopoverButton } from "../generic/popovers/popovers";
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import { Unit } from 'mathjs'
import TextSingleAutocomplete from "../form/elements/combobox/textSingleAutocomplete";

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

  return (
    <textarea
      rows={3}
      placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
      style={{
        border: '0',
        borderRadius: '.25rem 0 0 0',
      }}
      value={recipe?.eq || ""}
      onChange={handleUpdatedEq}
    />
  )
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

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [selectedRoadmaps, setSelectedRoadmaps] = useState<string[]>([]);
  const [availableDataSeries, setAvailableDataSeries] = useState<{ id: string; name: string; roadmapId: string; }[]>([]);

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
            name: goal.name || goal.indicatorParameter,
            roadmapId: roadmapId,
            ...(goal.dataSeries.unit ? { unit: goal.dataSeries.unit } : {})
          }
        });
        if (!series || series.length === 0) {
          console.warn("No data series found in roadmap", roadmapId);
          return;
        }

        const nonNullSeries = series.filter(ds => ds !== null);

        setAvailableDataSeries(nonNullSeries);
      }
      catch (e) {
        console.error("Failed to fetch data series for roadmap", e);
      }
    }

    async function fetchAllDataSeries() {
      if (!selectedRoadmaps || selectedRoadmaps.length === 0) return;

      // TODO: even though it iterates it will override the last fetched data series
      for (const roadmapId of selectedRoadmaps) {
        await fetchOneDataSeries(roadmapId);
      }
    }

    fetchAllDataSeries().catch(e => { throw e; });

  }, [recipe, selectedRoadmaps]);

  const [newVariableName, setNewVariableName] = useState<string>('') // TODO: Can bunch into one
  const [newVariableUnit, setNewVariableUnit] = useState<string>('')
  const [newVariableType, setNewVariableType] = useState<RecipeDataTypes | undefined>(undefined)

  // Hard coded to make a new data series variable. TODO: reconsider this behavior
  const handleAddVariable = () => {
    if (newVariableType === undefined || newVariableName === '') return // TODO: Need to show that something is wrong to the user
    setRecipe(prev => {
      prev = prev || emptyRecipe;
      return {
        ...prev,
        variables: {
          ...prev.variables,
          [newVariableName]: { ...emptyRecipeDataTypes[newVariableType], unit: newVariableUnit },
        }
      }
    });
    setNewVariableName('')
    setNewVariableUnit('')
    setNewVariableType(undefined)
  };

  return (
    <>
      <ul className="list-style-none padding-0 margin-0 flex-grow-100">
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
              return (
                <ScalarVariable
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
                />
              )
            case RecipeDataTypes.DataSeries:
              return (
                <DataSeriesVariable
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
                  availableRoadmaps={availableRoadmaps}
                  availableDataSeries={availableDataSeries}
                  setSelectedRoadmaps={setSelectedRoadmaps}
                />
              )
            case RecipeDataTypes.External:
              return (
                <ExternalVariable
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
                />
              )
            default:
              variable = variable as RecipeVariables;
              console.warn("Unknown variable type", variable.type, "for variable", name);
          }
        })}
      </ul>
      {/* TODO: I18n */}
      {allowAddVariables &&
        <>
          <PopoverButton
            anchorName="--add-variable-popover-button"
            popoverTarget="add-variable-popover"
            className="font-weight-600 margin-left-auto block"
            style={{ transform: 'scale(1)'}}
          >
            {t("components:copy_and_scale.add_variable")}
          </PopoverButton>
          <Popover
            id="add-variable-popover"
            popover="auto"
            positionAnchor="--add-variable-popover-button"
            anchorInlinePosition="center"
            popoverDirection={{
              vertical: 'down',
              horizontal: 'left'
            }}
            margin='.5rem'
          >
            <fieldset
              className="padding-50 smooth"
              style={{
                border: '1px solid var(--gray)',
                backgroundColor: 'white',
              }}
            >
              <label htmlFor="variable-name" className="cursor-text">
                Namn
              </label>
              <input
                type="text"
                id="variable-name"
                className="margin-bottom-50"
                style={{ backgroundColor: 'var(--gray-95)' }}
                placeholder="Variabel 1" // TODO: I18n
                value={newVariableName}
                onChange={(e) => setNewVariableName(e.target.value)}
              />
              <label htmlFor="variable-unit">
                Enhet
              </label>
              <TextSingleAutocomplete
                props={{
                  id: "variable-unit",
                  name: "variable-unit",
                  placeholder: "Skriv för att se förslag" // TODO: I18n 
                }}
                theme={{
                  style: {backgroundColor: 'var(--gray-95)'}
                }}
                options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
                maxOptions={2.55}
                onChange={(unit) => {setNewVariableUnit(unit)}}
              />
              <div className="margin-block-100">
                <label className="block margin-left-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.Scalar}
                    checked={newVariableType === RecipeDataTypes.Scalar}
                    onChange={() => setNewVariableType(RecipeDataTypes.Scalar)}
                  />
                  Skalär
                </label>
                <label className="block margin-left-25 margin-top-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.DataSeries}
                    checked={newVariableType === RecipeDataTypes.DataSeries}
                    onChange={() => setNewVariableType(RecipeDataTypes.DataSeries)}
                  />
                  Dataserie
                </label>
                <label className="block margin-left-25 margin-top-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.External}
                    checked={newVariableType === RecipeDataTypes.External}
                    onChange={() => setNewVariableType(RecipeDataTypes.External)}
                  />
                  Extern data
                </label>
              </div>
              <button
                type="button"
                className="width-100 color-purewhite font-weight-600 margin-top-50"
                style={{ backgroundColor: '#191919' }}
                popoverTarget='add-variable-popover'
                onClick={handleAddVariable}
              >
                Skapa variabel
              </button>
            </fieldset>
          </Popover>
        </>
      }
    </>
  );
}

export function RecipeErrorAndWarnings() {
  const { t } = useTranslation("components");
  const { error, warnings } = useRecipe();

  return (
    <>
      {error ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'red', fontSize: '14px' }}>
          <IconCircleXFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="red" aria-label={t("components:copy_and_scale.evaluation_error_title")} />
          {error}
        </div>
        : null}

      {!error ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'green', fontSize: '14px' }}>
          <IconCircleCheckFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="green" /> {/* TODO: Aria-label */}
          Recipe is valid
        </div>
        : null}

      {warnings.length > 0 ?
        <ul className="margin-0 padding-0" lang={Locales.enSE} style={{ color: 'darkorange', listStyle: 'none', fontSize: '14px' }}>
          {warnings.map((warning, i) => (
            <li key={i} className="flex align-items-flex-start gap-50 margin-block-50">
              <IconAlertTriangleFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="darkorange" aria-label={t("components:copy_and_scale.evaluation_warning_title")} /> {/* TODO: Check this translation */}
              {warning}
            </li>
          ))}
        </ul>
        : null}
    </>
  );
}

// TODO: remove this once things work
export function DEBUG_Recipe() {
  return <pre style={{ width: '90ch', overflowX: 'scroll' }}>
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
    <>
      {/* Hidden input for reading into the form */}
      {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(resultingDataSeries)} />}

      {/* TODO: Keep unit but not title?
      <strong className="block bold text-align-center">
        {t("components:copy_and_scale.resulting_data_series")}
        {resultingUnit ? ` (${resultingUnit})` : ""}
      </strong>
      */}

      <div
        className="grid gap-100 padding-bottom-50"
        style={{
          gridTemplateColumns: `repeat(${Object.keys(resultingDataSeries).length}, 1fr)`,
          gridTemplateRows: 'auto auto',
          overflowX: 'scroll',
          scrollbarWidth: 'thin',
          contain: 'inline-size',
        }}
      >
        {Object.keys(resultingDataSeries).map((year, i) => (
          <div className="text-align-center" style={{ gridRow: 1 }} key={i + "resulting-data-series-header" + year}>{year.replace("val", "")}</div>
        ))}
        {Object.values(resultingDataSeries).map((value, i) => (
          <div className="text-align-center" style={{ gridRow: 2 }} key={i + "resulting-data-series-value" + String(value)}>{(value as number)?.toFixed(1) || "-"}</div>
        ))}
      </div>
    </>
  )
}

export function ResultingRecipe({ FormElement }: { FormElement?: ReactElement }) {
  const { recipe } = useRecipe();

  if (!recipe) {
    return null;
  }

  return (<>
    {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(recipe)} />}
  </>);
}