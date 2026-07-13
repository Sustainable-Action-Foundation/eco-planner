'use client';

import type { Dispatch, SetStateAction } from "react";
import { GoalFormName } from "../../formNames";
import type { Goal } from "@/types";
import { useTranslation } from "react-i18next";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { IconCheck } from "@tabler/icons-react";
import { InheritingBaseline } from "../goalFormSections";
import { dataSeriesToDateValues } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { BaselineType } from "../../forms/goal";
 
type BaselineType = (typeof BaselineType)[keyof typeof BaselineType];

export default function BaselineSeriesSection({
  goal,
  baselineType,
  setBaselineType,
}: {
  goal: Goal | undefined;
  baselineType: BaselineType;
  setBaselineType: Dispatch<SetStateAction<BaselineType>>
}) {
  const { t } = useTranslation(["forms", "common"]);
 
  return (
    <>
      <fieldset className="margin-top-25 fieldset-unset-pseudo-class">
        <legend className="padding-block-125 font-weight-bold">{t("forms:goal.baseline_label")}</legend>
        <div className="width-100 radio-group">
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Initial}
              checked={baselineType === BaselineType.Initial}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            {t("forms:goal.baseline_types.initial")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.InitialNonZero}
              checked={baselineType === BaselineType.InitialNonZero}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            {t("forms:goal.baseline_types.initial_non_zero")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Custom}
              checked={baselineType === BaselineType.Custom}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            {t("forms:goal.baseline_types.custom")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-25">
            <input
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Inherited}
              checked={baselineType === BaselineType.Inherited}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            {t("forms:goal.baseline_types.inherited")}
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--gray-60)' }}
      >

        {/* First value baseline */}
        {baselineType === BaselineType.Initial &&
          <>
            <p className="margin-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.baseline_types.initial")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
          </>
        }

        {/* First non-zero value baseline */}
        {baselineType === BaselineType.InitialNonZero &&
          <>
            <p className="margin-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.baseline_types.initial_non_zero")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
          </>
        }

        {/* Custom baseline input */}
        {baselineType === BaselineType.Custom &&
          <>
            <p className="margin-top-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.baseline_types.custom")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <RecipeContextProvider
              initialRecipe={Recipe.fromManualDateValues(
                goal?.baseline ? dataSeriesToDateValues(goal.baseline) : { unit: undefined, dateValues: {} },
              ).serialize()}
            >
              <ManualDataSeriesInput
                id="baseline-dataseries"
                label={t("forms:data_series_input.data_series")}
                {...goal?.baseline
                  ? { initialDateValues: dataSeriesToDateValues(goal.baseline) }
                  : {}
                }
              />
              <FormSync DateValuesFormElement={<input name={GoalFormName.BaselineDataSeries} />} />
            </RecipeContextProvider>
          </>
        }

        {/* Inherited baseline input */}
        {baselineType === BaselineType.Inherited &&
          <>
            <p className="margin-top-0 font-size-125 font-weight-500 flex gap-50 align-items-center" style={{ color: 'var(--blue)' }}>
              <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
              <span>
                {t("forms:goal.using")}
                <span className="text-transform-lowercase"> {t("forms:goal.baseline_types.inherited")}</span>
              </span>
            </p> {/* TODO: Should be a legend? */}
            <InheritingBaseline
              outputFormElement={<input name={GoalFormName.InheritedBaselineId} />}
            />
          </>
        }
      </div>
    </>
  );
}