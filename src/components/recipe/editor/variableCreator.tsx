"use client"

import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";
import { useRecipe } from "../context/recipeContext.use";
import { useRef, useState } from "react";
import { emptyRecipesByDataType, RecipeDataTypes } from "@/functions/recipe/types";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { useTranslation } from "react-i18next";
import { allOurUnits } from "@/math";

export function VariableCreator({
  allowAddVariables = false,
}: {
  allowAddVariables?: boolean;
}) {
  const { t } = useTranslation(["components", "forms"]);
  const { recipe, setVariables } = useRecipe();

  const popoverRef = useRef<HTMLDivElement>(null);
  const [newName, setNewName] = useState<string>('');
  const [newNameStatus, setNewNameStatus] = useState<string>('');
  const [newUnit, setNewUnit] = useState<string>('');
  const [newType, setNewType] = useState<RecipeDataTypes | undefined>(undefined);
  const [newTypeStatus, setNewTypeStatus] = useState<string>('');

  // Hard coded to make a new data series variable. TODO: reconsider this behavior
  const addVariableToContext = () => {
    if (newName === '') {
      setNewNameStatus(t("components:recipe_editor.provide_variable_name"));
      return;
    }
    if (!newType) {
      setNewTypeStatus(t("components:recipe_editor.provide_variable_type"));
      return;
    }
    const usedNames = Object.values(recipe?.variables ?? {}).map(variable => variable.name);
    if (usedNames.includes(newName)) {
      setNewNameStatus(t("components:recipe_editor.variable_name_exists"));
      return;
    }

    setVariables(prev => ({
      ...prev,
      // TODO: Don't index with the name, use a generated ID instead or change vars to an array
      [newName]: {
        ...emptyRecipesByDataType[newType],
        ...newUnit ? { unit: newUnit } : {},
      },
    }));

    // Clear the form after adding to context
    setNewName('');
    setNewUnit('');
    setNewType(undefined);
    setNewNameStatus('')
    setNewTypeStatus('')
    popoverRef.current?.hidePopover()
  };

  if (!allowAddVariables) return null;

  return (
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
        ref={popoverRef}
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
            style={{ backgroundColor: 'var(--gray-95)' }}
            placeholder={t("components:recipe_editor.variable_name_placeholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <small className="block margin-bottom-50 margin-top-25 font-weight-500" style={{ color: 'red' }}>{newNameStatus}</small>
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
            options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            maxOptions={3}
            onChange={(unit) => setNewUnit(unit ?? '')}
          />
          <div className="margin-top-100">
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
          <small className="block margin-bottom-100 margin-top-25 font-weight-500" style={{ color: 'red' }}>{newTypeStatus}</small>
          <button
            type="button"
            className="width-100 color-purewhite font-weight-600 margin-top-50"
            style={{ backgroundColor: '#191919' }}
            onClick={addVariableToContext}
          >
            {t("components:recipe_editor.create_variable")}
          </button>
        </fieldset>
      </Popover>
    </>
  );
}