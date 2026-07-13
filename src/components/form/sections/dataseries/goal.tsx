'use client';

import { useTranslation } from "react-i18next";
import TextSingleAutocomplete from "../../elements/combobox/textSingleAutocomplete";
import { GoalFormName } from "../../formNames";
import type { DateValuesWithUnit, Goal, UnitString } from "@/types";
import mathjs, { allOurUnits } from "@/math";
import { DataSeriesType } from "../../forms/goal";
import { IconCheck } from "@tabler/icons-react";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider, RecipeEditor, type SetStateAction, SuggestedRecipeApplier } from "@/components/recipe";
import { dataSeriesToDateValues, Recipe } from "@/functions/recipe";
import ParameterSync from "@/components/recipe/output/parameterSyncer";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import type { Dispatch } from "react";

type DataSeriesType = (typeof DataSeriesType)[keyof typeof DataSeriesType];

export default function GoalSeriesSection({
  goal,
  unit,
  setUnit,
  parsedUnit,
  setParsedUnit,
  dataSeriesType,
  setDataSeriesType,
  setIndicatorParameter,
  setPreviewDataSerie,
  setDataSeriesRecipeError,
  hasInitializedSuggested,
  hasInitializedCustom,
}: {
  goal: Goal | undefined;
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
  parsedUnit: UnitString;
  setParsedUnit: Dispatch<SetStateAction<UnitString>>;
  dataSeriesType: DataSeriesType;
  setDataSeriesType: Dispatch<SetStateAction<DataSeriesType>>;
  setIndicatorParameter: Dispatch<SetStateAction<string>>;
  setPreviewDataSerie: Dispatch<SetStateAction<DateValuesWithUnit | null>>;
  setDataSeriesRecipeError: Dispatch<SetStateAction<string | null>>;
  hasInitializedSuggested: boolean;
  hasInitializedCustom: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);
  
  const manualInitialDateValues = goal?.dataSeries
    ? dataSeriesToDateValues(goal.dataSeries)
    : undefined;

  return (
    <>
      <label htmlFor="dataUnit">
        {t("forms:goal.data_unit")}
      </label>
      <TextSingleAutocomplete
        props={{
          id: "dataUnit",
          name: GoalFormName.DataUnit,
          placeholder: t("forms:combobox.default_autocomplete_placeholder"),
          className: "margin-top-25",
          defaultValue: goal?.dataSeries?.unit ?? undefined,
        }}
        options={allOurUnits.map(u => ({ name: u, value: u }))}
        onChange={(unit) => {
          try {
            setParsedUnit(mathjs.unit(unit).toString());
          } catch {
            setParsedUnit(null);
          }
        }}
        value={unit}
        setter={setUnit}
      />
      <small className="block margin-top-25 margin-bottom-100 font-style-italic" style={{ height: '20px' }}>
        {parsedUnit === null && t("forms:goal.unit_not_interpreted")}

        {parsedUnit ? <>
          {t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong>
        </> : null}
      </small>

      {/* Radio group */}
      <fieldset className="border-none padding-0 margin-0 radio-group fieldset-unset-pseudo-class" role="radiogroup" aria-label={t("forms:goal.choose_goal_data_series")}>
        <legend className="padding-block-125 font-weight-bold">{t("forms:goal.goal_label")}</legend>
        <label className="flex align-items-center gap-50 margin-bottom-25">
          <input
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Suggested}
            checked={dataSeriesType === DataSeriesType.Suggested}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
          />
          {t("forms:goal.suggested_inheritance")}
        </label>
        <label className="flex align-items-center gap-50 margin-bottom-25">
          <input
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Manual}
            checked={dataSeriesType === DataSeriesType.Manual}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
          />
          {t("forms:goal.static_data_series")}
        </label>
        <label className="flex align-items-center gap-50 margin-bottom-25">
          <input
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Custom}
            checked={dataSeriesType === DataSeriesType.Custom}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
          />
          {t("forms:goal.custom_recipe")}
        </label>
      </fieldset>

      {/**
            ## NOTE:

            The following fieldsets are intentionally hidden and not unmounted to preserve state.
          */}
      {/* Suggested */}
      <div
        className="padding-100 smooth margin-bottom-100"
        style={{ border: '1px dashed var(--blue)' }}
      >
        {hasInitializedSuggested ?
          <fieldset className={`${dataSeriesType !== DataSeriesType.Suggested ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Suggested}>
            <p className="margin-top-0 flex gap-50 align-items-center" style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                <span className="text-transform-capitalize">{t("common:tsx.using")}:</span>
                <span className="text-transform-lowercase"> {t("forms:goal.suggested_inheritance")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <RecipeContextProvider
              initialRecipe={goal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(goal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}
              availableDataSeries={goal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <SuggestedRecipeApplier />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
                onUnit={setUnit}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Suggested}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Manual */}
        <fieldset className={`${dataSeriesType === DataSeriesType.Manual ? "" : "display-none"}`} disabled={dataSeriesType !== DataSeriesType.Manual}>
          <p className="margin-top-0 flex gap-50 align-items-center" style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
            <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
            <span>
                <span className="text-transform-capitalize">{t("common:tsx.using")}:</span>
              <span className="text-transform-lowercase"> {t("forms:goal.static_data_series")}</span>
            </span>
          </p> {/* TODO: Should be a legend? */}
          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues(manualInitialDateValues ?? { unit: undefined, dateValues: {} }).serialize()}
          >
            <ManualDataSeriesInput
              id="goal-dataseries"
              label={t("forms:data_series_input.data_series")}
              initialDateValues={manualInitialDateValues}
            />
            <FormSync
              RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
              DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
            />
          </RecipeContextProvider>
        </fieldset>

        {/* Recipe */}
        {hasInitializedCustom ?
          <fieldset className={`${dataSeriesType !== DataSeriesType.Custom ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Custom}>
            <p className="margin-top-0 flex gap-50 align-items-center" style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                <span className="text-transform-capitalize">{t("common:tsx.using")}:</span>
                <span className="text-transform-lowercase"> {t("forms:goal.custom_recipe")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <RecipeContextProvider
              initialRecipe={goal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(goal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}
              availableDataSeries={goal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <RecipeEditor />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
                onUnit={setUnit}
                onDateValues={setPreviewDataSerie}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Custom}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }
      </div>
    </>
  );
}