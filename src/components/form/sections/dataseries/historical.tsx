"use client";

import type { Goal } from "@/types";
import { GoalFormName } from "@/types/form-names";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalDataSeriesInput, FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { dataSeriesToDateValues, Recipe } from "@/functions/recipe";
import { IconCheck } from "@tabler/icons-react";

// TODO: Historical data should not be required in a goal form
// TODO: Check if selecting metric actually changes selectable values

const HistoricalDataType = {
  External: "EXTERNAL",
  Custom: "CUSTOM",
} as const;
type HistoricalDataType = (typeof HistoricalDataType)[keyof typeof HistoricalDataType];

function resolveHistoricalDataType(goal?: Goal): HistoricalDataType {
  const recipe = goal?.historical?.recipeUsed?.recipe;
  if (!recipe) return HistoricalDataType.External;

  // Manual entry stored as an inline data series recipe; anything else (e.g. an
  // external API selection) edits as external.
  return Recipe.from(recipe).isManual()
    ? HistoricalDataType.Custom
    : HistoricalDataType.External;
}

export default function HistoricalSeriesSection({
  goal,
}: {
  goal: Goal | undefined
}) {
  const { t } = useTranslation("components");

  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(() => resolveHistoricalDataType(goal));

  const savedHistoricalRecipe = goal?.historical?.recipeUsed?.recipe;
  const savedIsManual = !!savedHistoricalRecipe && Recipe.from(savedHistoricalRecipe).isManual();

  // Seed each input from the saved historical recipe when it was made with the
  // same input type; the other one starts empty.
  const manualInitialDateValues = savedIsManual && goal?.historical
    ? dataSeriesToDateValues(goal.historical)
    : undefined;
  const externalInitialRecipe = useMemo(() => {
    if (!savedHistoricalRecipe || savedIsManual) return undefined;
    return Recipe.from(savedHistoricalRecipe).withEditableExternals().serialize();
  }, [savedHistoricalRecipe, savedIsManual]);

  return (
    <>
      {/* Radio group */}
      <fieldset className="fieldset-unset-pseudo-class">
        <legend className="margin-bottom-25">{t("forms:goal.data_series.historical.type")}</legend>
        <div className="width-100 radio-group">
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
              <span className="block" style={{textShadow: '0 0'}}>{t("forms:goal.data_series.historical.external_title")}</span>
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
              <span className="block" style={{textShadow: '0 0'}}>{t("forms:goal.data_series.historical.custom_title")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.historical.custom")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--blue)' }}
      >
        <p className="margin-top-0 flex gap-50 align-items-center" style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
          <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
          <span>
            <span className="text-transform-capitalize">{t("common:tsx.using")}</span>
            <span className="text-transform-lowercase">{historicalDataType === HistoricalDataType.External ? ` ${t("forms:goal.historical_data.external")}` : ` ${t("forms:goal.historical_data.custom")}`}</span>
          </span>
        </p> {/* TODO: Should be a legend? */}
        {historicalDataType === HistoricalDataType.External ? (
          <RecipeContextProvider
            initialRecipe={externalInitialRecipe}
            availableDataSeries={goal?.historical?.recipeUsed?.sourceDataSeries}
          >
            <ExternalDataSeriesInput goal={goal} />
            <FormSync
              RecipeFormElement={<input name={GoalFormName.HistoricalRecipe} />}
              DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />}
            />
          </RecipeContextProvider>
        ) :
          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues(manualInitialDateValues ?? { unit: undefined, dateValues: {} }).serialize()}
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
          </RecipeContextProvider>
        }
      </div>
    </>
  );
};
