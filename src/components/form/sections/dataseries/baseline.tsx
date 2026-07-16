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
      {/* Radio group */}
      <fieldset className="fieldset-unset-pseudo-class">
        <legend className="margin-bottom-25">{t("forms:goal.data_series.baseline.type")}</legend>
        <div className="width-100 radio-group">
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Initial}
              checked={baselineType === BaselineType.Initial}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.initial")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.first_year_value")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.InitialNonZero}
              checked={baselineType === BaselineType.InitialNonZero}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.initial_non_zero")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.first_defined_year")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Custom}
              checked={baselineType === BaselineType.Custom}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.custom")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.custom")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Inherited}
              checked={baselineType === BaselineType.Inherited}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.inherited")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.another_goal")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--blue)' }}
      >
        <p className={`${baselineType === BaselineType.Initial || baselineType === BaselineType.InitialNonZero ? "margin-0" : "margin-top-0"} flex gap-50 align-items-center`} style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>          <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
          <span>
            <span className="text-transform-capitalize">{t("common:tsx.using")}</span>
            <span className="text-transform-lowercase">
              {baselineType === BaselineType.Initial ? ` ${t("forms:goal.baseline_types.initial")}`
                : baselineType === BaselineType.InitialNonZero ? ` ${t("forms:goal.baseline_types.initial_non_zero")}`
                  : baselineType === BaselineType.Custom ? ` ${t("forms:goal.baseline_types.custom")}`
                    : ` ${t("forms:goal.baseline_types.inherited")}`}
            </span>
          </span>
        </p> {/* TODO: Should be a legend? */}

        {/* Custom baseline input */}
        {baselineType === BaselineType.Custom &&
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
        }

        {/* Inherited baseline input */}
        {baselineType === BaselineType.Inherited &&
          <InheritingBaseline
            outputFormElement={<input name={GoalFormName.InheritedBaselineId} />}
          />
        }
      </div>
    </>
  );
}