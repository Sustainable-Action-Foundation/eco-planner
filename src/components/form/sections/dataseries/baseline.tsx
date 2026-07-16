'use client';

import type { Dispatch, SetStateAction } from "react";
import { GoalFormName } from "../../formNames";
import type { ClientGoal, Goal } from "@/types";
import { BaselineType } from "@/types";
import { useTranslation } from "react-i18next";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { IconCheck } from "@tabler/icons-react";
import { dataSeriesToDateValues } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import React, { useEffect, useState } from "react";
import type { TreeItem } from "@/components/types";
import { clientSafeGetRoadmaps, clientSafeGetOneRoadmap, clientSafeGetOneGoal } from "@/fetchers/client";
import SelectSingleTree from "@/components/form/elements/combobox/selectSingleTree";

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

function InheritingBaseline({
  outputFormElement,
}: {
  outputFormElement: React.ReactElement<HTMLInputElement>;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<TreeItem | null>(null);
  const [goalData, setGoalData] = useState<ClientGoal | null>(null);

  // Roadmaps are the top-level nodes; each one's goals are fetched lazily
  // the first time it's expanded, via onExpand.
  useEffect(() => {
    clientSafeGetRoadmaps()
      .then((roadmapList) => {
        setTreeItems(
          roadmapList.map((roadmap): TreeItem => ({
            value: roadmap.id,
            name: `${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`,
            expanded: false,
            onExpand: async () => {
              const roadmapData = await clientSafeGetOneRoadmap(roadmap.id).catch(() => null);
              if (!roadmapData) return [];
              return roadmapData.goals.map((goal): TreeItem => ({
                value: goal.id,
                name: `${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing")})`,
                expanded: null,
              }));
            },
          })),
        );
      })
      .catch(() => setTreeItems([]));
  }, [t]);

  // Once a goal is picked in the tree, fetch the full goal record so we can
  // read its baseline (the roadmap-level goal list only carries the dataSeries id).
  useEffect(() => {
    if (!selectedGoal || selectedGoal.value === "") {
      setGoalData(null);
      return;
    }
    clientSafeGetOneGoal(selectedGoal.value)
      .then(setGoalData)
      .catch(() => {
        setGoalData(null);
      });
  }, [selectedGoal]);

  return (
    <>
      {/* Roadmap + goal select, combined into a single expandable tree.
          NOTE: SelectSingleTree must NOT be nested inside the <label> - the
          toggle <button> it renders would get an implicit label association,
          and the browser then re-fires a synthetic click on that button for
          *any* click inside the label (including clicks on tree items),
          which stomps on menuOpen and causes the menu to open/close
          unpredictably. Associate the label via htmlFor instead. */}
      <label htmlFor="inheritFrom">
        {t("forms:goal.select_goal_as_baseline")}
      </label>
      <SelectSingleTree
        treeItems={treeItems}
        props={{
          id: "inheritFrom",
          name: "inheritFrom",
          required: true,
          className: "block margin-top-25 margin-bottom-100 width-100",
          placeholder: t("forms:goal.select_goal"),
        }}
        onChange={setSelectedGoal}
      />

      {goalData ? <label className="block margin-block-75">
        {`${t("forms:goal.baseline_copied")}: "${goalData.name}"`}
        {React.cloneElement(outputFormElement, {
          value: goalData.baseline?.id ?? goalData.dataSeries?.id ?? "",
          type: "hidden",
          hidden: true,
          readOnly: true,
        })}
      </label> : null
      }
    </>
  );
}