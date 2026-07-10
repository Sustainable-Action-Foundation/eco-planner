"use client";

import type { Goal } from "@/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { GoalFormName } from "../../formNames";
import type getTableMetadata from "@/lib/api/getTableMetadata";
import ExternalData from "../../api/externalData";

// TODO: Historical data should not be required in a goal form

export type ExternalSelection = NonNullable<Parameters<typeof getTableMetadata>[2]>;

const HistoricalDataType = {
  External: "EXTERNAL",
  Custom: "CUSTOM",
} as const;
type HistoricalDataType = (typeof HistoricalDataType)[keyof typeof HistoricalDataType];

export default function HistoricalDataSection({
  goal,
}: {
  goal?: Goal
}) {

  const { t } = useTranslation("components");

  
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(HistoricalDataType.External); // Default to external right now but solve this the same way we solve baseline at a late point
 
  
  return (
    <>
      <label>
        {t("forms:goal.historical_label")}
        <select className="block margin-top-25 margin-bottom-100" name="baselineSelector" id="baselineSelector" value={historicalDataType} onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}>
          <option value={HistoricalDataType.External}>{t("forms:goal.historical_data.external")}</option>
          <option value={HistoricalDataType.Custom}>{t("forms:goal.historical_data.custom")}</option>
        </select>
      </label>

      {historicalDataType === HistoricalDataType.External ? (
        <ExternalData 
          goal={goal}
        />
      ) :
        <RecipeContextProvider
          initialRecipe={Recipe.fromManualDateValues({ unit: undefined, dateValues: {} }).serialize()}
        >
          <ManualDataSeriesInput
            id="historical-data-series"
            label={t("forms:data_series_input.data_series")}
          />
          <FormSync DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />} />
        </RecipeContextProvider>
      }
    </>
  );
};