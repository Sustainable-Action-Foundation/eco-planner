"use client";

import type { Goal } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { GoalFormName } from "../../formNames";
import type getTableMetadata from "@/lib/api/getTableMetadata";
import ExternalData from "../../api/externalData";
import type { ExternalDataState } from "@/components/types";
import { IconCheck } from "@tabler/icons-react";

// TODO: Historical data should not be required in a goal form
// TODO: Check if selecting metric actually changes selectable values

export type ExternalSelection = NonNullable<Parameters<typeof getTableMetadata>[2]>;

const HistoricalDataType = {
  External: "EXTERNAL",
  Custom: "CUSTOM",
} as const;
type HistoricalDataType = (typeof HistoricalDataType)[keyof typeof HistoricalDataType];


export default function HistoricalSeriesSection({
  goal,
  onChange,
}: {
  goal: Goal | undefined
  onChange?: (data: ExternalDataState) => void;
}) {
  const { t } = useTranslation("components");

  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(HistoricalDataType.External); // Default to external right now but solve this the same way we solve baseline at a late point
  const [externalData, setExternalData] = useState<ExternalDataState>(null);

  useEffect(() => {
    // Only forward data when External is selected; clear it otherwise
    onChange?.(historicalDataType === HistoricalDataType.External ? externalData : null);
  }, [historicalDataType, externalData, onChange]);

  const handleExternalDataChange = useCallback((data: ExternalDataState) => {
    setExternalData(data);
  }, []);


  return (
    <>
      <fieldset className="margin-top-25 fieldset-unset-pseudo-class">
        <legend className="padding-block-125 font-weight-bold">{t("forms:goal.historical_label")}</legend>
        <div className="width-100 radio-group">
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name="historical-data-type"
              value={HistoricalDataType.External}
              checked={historicalDataType === HistoricalDataType.External}
              onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}
            />
            {t("forms:goal.historical_data.external")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name="historical-data-type"
              value={HistoricalDataType.Custom}
              checked={historicalDataType === HistoricalDataType.Custom}
              onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}
            />
            {t("forms:goal.historical_data.custom")}
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--gray-60)' }}
      >
        {historicalDataType === HistoricalDataType.External ? (
          <>
            <p className="margin-top-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.historical_data.external")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <ExternalData
              goal={goal}
              onChange={handleExternalDataChange}
            />
          </>
        ) :
          <>
            <p className="margin-top-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.historical_data.custom")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <RecipeContextProvider
              initialRecipe={Recipe.fromManualDateValues({ unit: undefined, dateValues: {} }).serialize()}
            >
              <ManualDataSeriesInput
                id="historical-data-series"
                label={t("forms:data_series_input.data_series")}
              />
              <FormSync DateValuesFormElement={<input name={GoalFormName.HistoricalDataSeries} />} />
            </RecipeContextProvider>
          </>
        }
      </div>
    </>
  );
};