"use client"

import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";
import { useRecipe } from "../../contextProvider";
import { useState } from "react";
import { emptyRecipesByDataType, RecipeDataTypes } from "@/functions/recipe-parser/types";
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
  const { setRecipe } = useRecipe();

  // These can't easily be combined due to rerender loops 
  const [newName, setNewName] = useState<string>('');
  const [newUnit, setNewUnit] = useState<string>('');
  const [newType, setNewType] = useState<RecipeDataTypes | undefined>(undefined);

  // Hard coded to make a new data series variable. TODO: reconsider this behavior
  const addVariableToContext = () => {
    if (newType === undefined || newName === '') return; // TODO: Need to show that something is wrong to the user

    setRecipe(prev => {
      if (!prev) return prev; // Should never happen since the context defines it on mount
      if (!newType) return prev;

      return {
        ...prev,
        variables: {
          ...prev.variables,
          [newName]: {
            ...emptyRecipesByDataType[newType],
            ...newUnit ? { unit: newUnit } : {},
          },
        }
      }
    });

    // Clear the form after adding to context
    setNewName('');
    setNewUnit('');
    setNewType(undefined);
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <label htmlFor="variable-unit">
                Enhet
              </label>
              <TextSingleAutocomplete
                props={{
                  id: "variable-unit",
                  name: "variable-unit",
                  placeholder: "Skriv för att se förslag", // TODO: I18n 
                  defaultValue: newUnit,
                }}
                theme={{
                  style: { backgroundColor: 'var(--gray-95)' }
                }}
                options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
                maxOptions={3}
                onChange={(unit) => setNewUnit(unit ?? '')}
              />
              <div className="margin-block-100">
                <label className="block margin-left-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.Scalar}
                    checked={newType === RecipeDataTypes.Scalar}
                    onChange={() => setNewType(RecipeDataTypes.Scalar)}
                  />
                  Skalär {/* TODO: i18n */}
                </label>
                <label className="block margin-left-25 margin-top-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.DataSeries}
                    checked={newType === RecipeDataTypes.DataSeries}
                    onChange={() => setNewType(RecipeDataTypes.DataSeries)}
                  />
                  Dataserie {/* TODO: i18n */}
                </label>
                <label className="block margin-left-25 margin-top-25">
                  <input
                    type="radio"
                    className="margin-right-25"
                    name="variable-type"
                    value={RecipeDataTypes.External}
                    checked={newType === RecipeDataTypes.External}
                    onChange={() => setNewType(RecipeDataTypes.External)}
                  />
                  Extern data {/* TODO: i18n */}
                </label>
              </div>
              <button
                type="button"
                className="width-100 color-purewhite font-weight-600 margin-top-50"
                style={{ backgroundColor: '#191919' }}
                popoverTarget='add-variable-popover'
                onClick={addVariableToContext}
              >
                Skapa variabel {/* TODO: i18n */}
              </button>
            </fieldset>
          </Popover>
        </>
      }
    </>
  )
}