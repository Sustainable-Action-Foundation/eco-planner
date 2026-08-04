"use client";

import type { DateValuesWithUnit, Goal } from "@/types";
import { GoalFormName } from "@/types/form-names";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ExternalDataSeriesInput, FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { dataSeriesToDateValues, Recipe, type SerializedRecipe } from "@/functions/recipe";
import { IconCheck } from "@tabler/icons-react";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import { HistoricalDataType, UnitFlags } from "@/types/enums";
import { resolveHistoricalDataType } from "../../forms/goal";

// TODO: Historical data should not be required in a goal form
// TODO: Should have a "no historical values selection"

export default function HistoricalSeriesSection({
  goal,
  historicalDataType,
  setHistoricalDataType,
  setPreviewHistoricalSerie,
  setPreviewHistoricalRecipe,
  hasInitializedNone,
  hasInitializedExternal,
  hasInitializedManual,
}: {
  goal: Goal | undefined
  historicalDataType: HistoricalDataType;
  setHistoricalDataType: Dispatch<SetStateAction<HistoricalDataType>>;
  /** Receives the evaluated historical series for previewing (e.g. the goal form's graph); omit where no preview is shown. */
  setPreviewHistoricalSerie?: Dispatch<SetStateAction<DateValuesWithUnit | null>>;
  setPreviewHistoricalRecipe?: Dispatch<SetStateAction<SerializedRecipe | null>>;
  hasInitializedNone: boolean;
  hasInitializedExternal: boolean;
  hasInitializedManual: boolean;
}) {
  const { t } = useTranslation(["components", "forms"]);

  const savedHistoricalRecipe = goal?.historical?.recipe_used?.recipe;

  // Seed each input from the saved historical data when it was made with the
  // same input type; the other one starts empty.
  const manualInitialDateValues = goal?.historical && resolveHistoricalDataType(goal) === HistoricalDataType.Custom
    ? dataSeriesToDateValues(goal.historical)
    : undefined;

  const externalInitialRecipe = useMemo(() => {
    if (!savedHistoricalRecipe || manualInitialDateValues) return undefined;
    return Recipe.from(savedHistoricalRecipe).withEditableExternals().serialize();
  }, [savedHistoricalRecipe, manualInitialDateValues]);

  return (
    <>
      {/* Radio group */}
      <fieldset className="fieldset-unset-pseudo-class">
        <legend className="margin-bottom-25">{t("forms:goal.data_series.historical.type")}</legend>
        <div className="width-100 radio-group">
          {!goal?.historical?.values &&
            <label className="flex align-items-start gap-50 margin-bottom-25">
              <input
                required={true}
                type="radio"
                name="historical-data-type"
                value={HistoricalDataType.None}
                checked={historicalDataType === HistoricalDataType.None}
                onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}
              />
              <span>
                <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.data_series.historical.no_historical_title")}</span>
                <span style={{ color: '#292929' }}>{t("forms:goal.data_series.historical.no_historical")}</span>
              </span>
            </label>
          }
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name="historical-data-type"
              value={HistoricalDataType.External}
              checked={historicalDataType === HistoricalDataType.External}
              onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.data_series.historical.external_title")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.historical.external")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name="historical-data-type"
              value={HistoricalDataType.Custom}
              checked={historicalDataType === HistoricalDataType.Custom}
              onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.data_series.historical.custom_title")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.historical.custom")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--blue)' }}
      >
        <p className={`${historicalDataType === HistoricalDataType.None ? "margin-0" : "margin-top-0"} flex gap-50 align-items-center`} style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
          <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
          <span>
            {historicalDataType !== HistoricalDataType.None ?
              <span className="text-transform-capitalize">{t("common:tsx.using")}</span>
              : null}
            <span className="text-transform-lowercase">
              {historicalDataType === HistoricalDataType.External ? ` ${t("forms:goal.data_series.historical.external_title")}`
                : historicalDataType === HistoricalDataType.Custom ? ` ${t("forms:goal.data_series.historical.custom_title")}`
                  : ` ${t("forms:goal.data_series.historical.no_historical_description")}`
              }
            </span>
          </span>
        </p> {/* TODO: Should be a legend? */}

        {!goal?.historical?.values &&
          (hasInitializedNone ? (
            <fieldset className={`${historicalDataType === HistoricalDataType.None ? "" : "display-none"}`} disabled={historicalDataType !== HistoricalDataType.None}>
              <RecipeContextProvider>
                <FormSync
                  RecipeFormElement={<input name={GoalFormName.HistoricalRecipe} />}
                  DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />}
                />
                <RecipeSync
                  onDateValues={setPreviewHistoricalSerie}
                  active={historicalDataType === HistoricalDataType.None}
                />
              </RecipeContextProvider>
            </fieldset>
          ) : null)
        }

        {hasInitializedExternal ?
          <fieldset className={`${historicalDataType === HistoricalDataType.External ? "" : "display-none"}`} disabled={historicalDataType !== HistoricalDataType.External}>
            <RecipeContextProvider
              initialRecipe={externalInitialRecipe}
              availableDataSeries={goal?.historical?.recipe_used?.source_data_series}
            >
              <ExternalDataSeriesInput goal={goal} />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.HistoricalRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />}
              />
              <RecipeSync
                onDateValues={setPreviewHistoricalSerie}
                onRecipe={setPreviewHistoricalRecipe}
                active={historicalDataType === HistoricalDataType.External}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {hasInitializedManual ?
          <fieldset className={`${historicalDataType === HistoricalDataType.Custom ? "" : "display-none"}`} disabled={historicalDataType !== HistoricalDataType.Custom}>
            <RecipeContextProvider
              initialRecipe={Recipe.fromManualDateValues(manualInitialDateValues ?? { unit: UnitFlags.Missing, dateValues: {} }).serialize()}
            >
              <ManualDataSeriesInput
                id="historical-data-series"
                label={t("forms:data_series_input.data_series")}
                initialDateValues={manualInitialDateValues}
              />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.HistoricalRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />}
              />
              <RecipeSync
                onDateValues={setPreviewHistoricalSerie}
                active={historicalDataType === HistoricalDataType.Custom}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }
      </div>
    </>
  );
};
