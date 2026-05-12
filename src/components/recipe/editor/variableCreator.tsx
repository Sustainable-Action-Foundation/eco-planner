"use client"

import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";
import { useRecipe } from "../context/recipeContext.use";
import { useRef, useState } from "react";
import { emptyRecipesByDataType, RecipeDataTypes } from "@/functions/recipe/types";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { useTranslation } from "react-i18next";
import { allOurUnits } from "@/math";
import { RecipeEditorPermissions } from "@/components/recipe/editor/recipeEditorPermissions";

export function VariableCreator({
  permissions: incomingPermissions,
}: {
  permissions?: RecipeEditorPermissions
}) {
  const { t } = useTranslation(["components", "forms"]);
  const { recipe, replaceVariables } = useRecipe();

  const popoverRef = useRef<HTMLDivElement>(null);

  const [providedName, setProvidedName] = useState<string>('');
  const [providedUnit, setProvidedUnit] = useState<string>('');
  const [providedType, setProvidedType] = useState<RecipeDataTypes | undefined>(undefined);

  const [nameStatus, setNameStatus] = useState<string>('');
  const [typeStatus, setTypeStatus] = useState<string>('');

  // Hard coded to make a new data series variable. TODO: reconsider this behavior
  const addVariableToContext = () => {
    if (providedName === '') {
      setNameStatus(t("components:recipe_editor.provide_variable_name"));
      return;
    }
    if (!providedType) {
      setTypeStatus(t("components:recipe_editor.provide_variable_type"));
      return;
    }
    const usedNames = recipe.variables.map(variable => variable.name);
    if (usedNames.includes(providedName)) {
      setNameStatus(t("components:recipe_editor.variable_name_exists"));
      return;
    }

    const usedIDs = recipe.variables.map(variable => variable.id);
    let newID = window.crypto.randomUUID();
    for (let i = 20; i > 0; i--) {
      if (!usedIDs.includes(newID)) break;
      newID = window.crypto.randomUUID();

      if (i <= 1) {
        console.error(`Failed to generate unique ID for new variable after 20 attempts. Compared against IDs: ${usedIDs.join(", ")}`);
        setNameStatus(t("components:recipe_editor.unable_to_generate_variable_id"));
        return;
      }
    }

    replaceVariables(prev => ([
      ...prev,
      {
        ...emptyRecipesByDataType[providedType],
        ...providedUnit ? { unit: providedUnit } : {},
        id: newID,
        name: providedName,
      },
    ]));

    // Clear the form after adding to context
    setProvidedName('');
    setProvidedUnit('');
    setProvidedType(undefined);
    setNameStatus('')
    setTypeStatus('')
    popoverRef.current?.hidePopover()
  };

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  if (!permissions.allowAddVariables) return null;

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
            value={providedName}
            onChange={(e) => setProvidedName(e.target.value)}
          />
          <small className="block margin-bottom-50 margin-top-25 font-weight-500" style={{ color: 'red' }}>{nameStatus}</small>
          <label htmlFor="variable-unit">
            {t("components:recipe_editor.unit_label")}
          </label>
          <TextSingleAutocomplete
            props={{
              id: "variable-unit",
              name: "variable-unit",
              placeholder: t("forms:combobox.default_autocomplete_placeholder"),
              defaultValue: providedUnit,
            }}
            theme={{
              style: { backgroundColor: 'var(--gray-95)' }
            }}
            options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            maxOptions={3}
            onChange={(unit) => setProvidedUnit(unit ?? '')}
          />
          <div className="margin-top-100">
            <label className="block margin-left-25">
              <input
                type="radio"
                className="margin-right-25"
                name="variable-type"
                value={RecipeDataTypes.Scalar}
                checked={providedType === RecipeDataTypes.Scalar}
                onChange={() => setProvidedType(RecipeDataTypes.Scalar)}
              />
              {t("components:recipe_editor.scalar")}
            </label>
            <label className="block margin-left-25 margin-top-25">
              <input
                type="radio"
                className="margin-right-25"
                name="variable-type"
                value={RecipeDataTypes.DataSeries}
                checked={providedType === RecipeDataTypes.DataSeries}
                onChange={() => setProvidedType(RecipeDataTypes.DataSeries)}
              />
              {t("components:recipe_editor.data_series")}
            </label>
            <label className="block margin-left-25 margin-top-25">
              <input
                type="radio"
                className="margin-right-25"
                name="variable-type"
                value={RecipeDataTypes.External}
                checked={providedType === RecipeDataTypes.External}
                onChange={() => setProvidedType(RecipeDataTypes.External)}
              />
              {t("components:recipe_editor.external_data")}
            </label>
          </div>
          <small className="block margin-bottom-100 margin-top-25 font-weight-500" style={{ color: 'red' }}>{typeStatus}</small>
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