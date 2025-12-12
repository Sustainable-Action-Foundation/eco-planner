"use client"

import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";
import { useRecipe } from "../../contextProvider";
import { useState } from "react";
import { emptyRecipesByDataType, RecipeDataTypes } from "@/functions/recipe-parser/types";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { Unit } from "mathjs";
import { useTranslation } from "react-i18next";

export default function VariableCreator({
  allowAddVariables = false,
}: {
  allowAddVariables?: boolean;
}) {
  const { t } = useTranslation(["components", "forms"]);
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
      {allowAddVariables &&
        <>
          <PopoverButton
            anchorName="--add-variable-popover-button"
            popoverTarget="add-variable-popover"
            className="align-items-center padding-block-25 padding-inline-50"
            style={{ transform: 'scale(1)' }}
          >
            {t("components:copy_and_scale.add_variable")}
          </PopoverButton>
          <Popover
            id="add-variable-popover"
            popover="auto"
            positionAnchor="--add-variable-popover-button"
            anchorInlinePosition="end"
            popoverDirection='down'
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
                {t("components:recipe_editor.variable_name")}
              </label>
              <input
                type="text"
                id="variable-name"
                className="margin-bottom-50"
                style={{ backgroundColor: 'var(--gray-95)' }}
                placeholder={t("components:recipe_editor.variable_name_placeholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <label htmlFor="variable-unit">
                {t("components:recipe_editor.unit_label")}
              </label>
              <TextSingleAutocomplete
                props={{
                  id: "variable-unit",
                  name: "variable-unit",
                  placeholder: t("forms:combobox.default_autocomplete_placeholder"),
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
                  {t("components:recipe_editor.scalar")}
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
                  {t("components:recipe_editor.data_series")}
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
                  {t("components:recipe_editor.external_data")}
                </label>
              </div>
              <button
                type="button"
                className="width-100 color-purewhite font-weight-600 margin-top-50"
                style={{ backgroundColor: '#191919' }}
                popoverTarget='add-variable-popover'
                onClick={addVariableToContext}
              >
                {t("components:recipe_editor.create_variable")}
              </button>
            </fieldset>
          </Popover>
        </>
      }
    </>
  )
}