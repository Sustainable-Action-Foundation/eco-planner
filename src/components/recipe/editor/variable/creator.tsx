"use client"

import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";
import { useRecipe } from "../../contextProvider";
import { useState } from "react";
import { emptyRecipe, emptyRecipeDataTypes, RecipeDataTypes } from "@/functions/recipe-parser/types";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { Unit } from "mathjs";
import { useTranslation } from "react-i18next";
import { IconPlus } from "@tabler/icons-react";

export default function VariableCreator({
  allowAddVariables = false,
}: {
  allowAddVariables?: boolean;
}) {
  const { t } = useTranslation("components");
  
  const { recipe, setRecipe } = useRecipe();

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
      {/* TODO: I18n */}
      {allowAddVariables &&
        <>
          <PopoverButton
            anchorName="--add-variable-popover-button"
            popoverTarget="add-variable-popover"
            className="flex gap-75 align-items-center round"
            style={{ transform: 'scale(1)', padding: '.3rem .6rem' }}
          >
            {t("components:copy_and_scale.add_variable")}
            <IconPlus height={16} width={16} aria-hidden="true" />
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
                  placeholder: "Skriv för att se förslag", // TODO: I18n 
                  defaultValue: newVariableUnit
                }}
                theme={{
                  style: { backgroundColor: 'var(--gray-95)' }
                }}
                options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
                maxOptions={3}
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
  )
}