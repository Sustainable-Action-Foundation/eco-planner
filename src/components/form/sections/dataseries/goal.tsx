'use client';

import { useTranslation } from "react-i18next";
import type { DateValuesWithUnit, Goal } from "@/types";
import { DataSeriesType } from "@/types/enums";
import { GoalFormName } from "@/types/form-names";
import { IconCheck } from "@tabler/icons-react";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider, RecipeEditor, SuggestedRecipeApplier, UnitInput } from "@/components/recipe";
import { dataSeriesToDateValues, Recipe } from "@/functions/recipe";
import ParameterSync from "@/components/recipe/output/parameterSyncer";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import { useMemo, type Dispatch, type SetStateAction } from "react";

export default function GoalSeriesSection({
  goal,
  dataSeriesType,
  setDataSeriesType,
  setIndicatorParameter,
  setPreviewDataSerie,
  setDataSeriesRecipeError,
  hasInitializedSuggested,
  hasInitializedManual,
  hasInitializedCustom,

}: {
  goal: Goal | undefined;
  dataSeriesType: DataSeriesType;
  setDataSeriesType: Dispatch<SetStateAction<DataSeriesType>>;
  setIndicatorParameter: Dispatch<SetStateAction<string>>;
  setPreviewDataSerie: Dispatch<SetStateAction<DateValuesWithUnit | null>>;
  setDataSeriesRecipeError: Dispatch<SetStateAction<string | null>>;
  hasInitializedSuggested: boolean;
  hasInitializedManual: boolean;
  hasInitializedCustom: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);

  const manualInitialDateValues = goal?.dataSeries
    ? dataSeriesToDateValues(goal.dataSeries)
    : undefined;

  const initialLoadedRecipe = useMemo(() => {
    const base = goal?.dataSeries?.recipeUsed?.recipe;
    if (!base) return undefined;

    return Recipe.from(base).withEditableExternals().serialize();
  }, [goal?.dataSeries?.recipeUsed?.recipe]);

  return (
    <>
      {/* Radio group */}
      <fieldset className="border-none padding-0 margin-0 radio-group fieldset-unset-pseudo-class" role="radiogroup" aria-label={t("forms:goal.choose_goal_data_series")}>
        <legend className="margin-bottom-25">{t("forms:goal.data_series.goal.type")}</legend>
        <label className="flex align-items-start gap-50 margin-bottom-25">
          <input
            required={true}
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Suggested}
            checked={dataSeriesType === DataSeriesType.Suggested}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            aria-label={`${t("forms:goal.suggested_inheritance")}: ${t("forms:goal.data_series.goal.inherit")}`}
          />
          <span>
            <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.suggested_inheritance")}</span>
            <span style={{ color: '#292929' }}>{t("forms:goal.data_series.goal.inherit")}</span>
          </span>
        </label>
        <label className="flex align-items-start gap-50 margin-bottom-25">
          <input
            required={true}
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Manual}
            checked={dataSeriesType === DataSeriesType.Manual}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
          />
          <span>
            <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.static_data_series")}</span>
            <span style={{ color: '#292929' }}>{t("forms:goal.data_series.goal.manual")}</span>
          </span>
        </label>
        <label className="flex align-items-start gap-50 margin-bottom-25">
          <input
            required={true}
            type="radio"
            name={GoalFormName.DataSeriesType}
            value={DataSeriesType.Custom}
            checked={dataSeriesType === DataSeriesType.Custom}
            onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
          />
          <span>
            <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.custom_recipe")}</span>
            <span style={{ color: '#292929' }}>{t("forms:goal.data_series.goal.recipe")}</span>
          </span>
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
        <p className="margin-top-0 flex gap-50 align-items-center" style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
          <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
          <span>
            <span className="text-transform-capitalize">{t("common:tsx.using")}</span>
            <span className="text-transform-lowercase">
              {dataSeriesType === DataSeriesType.Suggested ? ` ${t("forms:goal.suggested_inheritance")}`
                : dataSeriesType === DataSeriesType.Manual ? ` ${t("forms:goal.static_data_series")}`
                  : ` ${t("forms:goal.custom_recipe")}`}
            </span>
          </span>
        </p> {/* TODO: Should be a legend? */}
        {hasInitializedSuggested ?
          <fieldset className={`${dataSeriesType !== DataSeriesType.Suggested ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Suggested}>
            <RecipeContextProvider
              initialRecipe={initialLoadedRecipe}
              availableDataSeries={goal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <SuggestedRecipeApplier />
              <UnitInput
                id="goal-suggested-unit"
                staticProvidedUnit={goal?.dataSeries?.unit}
              />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                UnitFormElement={<input name={GoalFormName.DataUnit} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
                onDateValues={setPreviewDataSerie}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Suggested}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Manual */}
        {hasInitializedManual ?
          <fieldset className={`${dataSeriesType === DataSeriesType.Manual ? "" : "display-none"}`} disabled={dataSeriesType !== DataSeriesType.Manual}>
            <RecipeContextProvider
              initialRecipe={Recipe.fromManualDateValues(manualInitialDateValues ?? { unit: undefined, dateValues: {} }).serialize()}
            >
              <ManualDataSeriesInput
                id="goal-dataseries"
                label={t("forms:data_series_input.data_series")}
                initialDateValues={manualInitialDateValues}
              />
              <UnitInput
                id="goal-manual-unit"
                staticProvidedUnit={goal?.dataSeries?.unit}
              />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                UnitFormElement={<input name={GoalFormName.DataUnit} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <RecipeSync
                onDateValues={setPreviewDataSerie}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Manual}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Recipe */}
        {hasInitializedCustom ?
          <fieldset className={`${dataSeriesType !== DataSeriesType.Custom ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Custom}>
            <RecipeContextProvider
              initialRecipe={initialLoadedRecipe}
              availableDataSeries={goal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <RecipeEditor />
              <UnitInput
                id="goal-custom-unit"
                staticProvidedUnit={goal?.dataSeries?.unit}
              />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                UnitFormElement={<input name={GoalFormName.DataUnit} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
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