'use client'

import { emptyRecipe, emptyRecipeDataTypes, RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../variables";
import { Popover, PopoverButton } from "../../generic/popovers/popovers";
import { Unit } from 'mathjs'
import TextSingleAutocomplete from "../../form/elements/combobox/textSingleAutocomplete";
import { useRecipe } from "../contextProvider";
import styles from './editor.module.css'

// TODO: Rename
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

    // TODO: Need to do this when we expand a roadmap in our tree select instead of when we select one like we did previously
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
      <ul className={`list-style-none padding-0 margin-0 flex-grow-100 ${styles['variable-list']}`}>
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
            style={{ transform: 'scale(1)' }}
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
                  style: { backgroundColor: 'var(--gray-95)' }
                }}
                options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
                maxOptions={2.55}
                onChange={(unit) => { setNewVariableUnit(unit) }}
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