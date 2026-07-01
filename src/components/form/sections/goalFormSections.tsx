"use client";


import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientGoal, ClientMultiRoadmapInstance, ClientRoadmap, Goal } from "@/types";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { Recipe } from "@/functions/recipe/recipe";
import { clientSafeGetRoadmaps, clientSafeGetOneRoadmap, clientSafeGetOneGoal } from "@/fetchers/client";
import { ManualDataSeriesInput } from "../elements/dataSeriesInput/manualDataSeriesInput";
import { FormIntegration, RecipeContextProvider } from "@/components/recipe";

export function ManualGoalForm({
  currentGoal,
}: {
  currentGoal?: Goal;
}) {
  const { t } = useTranslation("forms");

  const initialDateValues = currentGoal?.dataSeries
    ? dataSeriesToDateValues(currentGoal.dataSeries)
    : undefined;

  return (
    <RecipeContextProvider
      initialRecipe={Recipe.fromManualDateValues(initialDateValues ?? { unit: undefined, dateValues: {} }).serialize()}
    >
      <ManualDataSeriesInput
        id="goal-dataseries"
        label={t("forms:data_series_input.data_series")}
        initialDateValues={initialDateValues}
      />
      <FormIntegration
        RecipeFormElement={<input name="resultingRecipe" />}
        DateValuesFormElement={<input name="resultingDateValues" />}
      />
    </RecipeContextProvider>
  );
}

export function InheritingBaseline({
  outputFormElement,
}: {
  outputFormElement: React.ReactElement<HTMLInputElement>;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [roadmapList, setRoadmapList] = useState<ClientMultiRoadmapInstance[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | undefined>(undefined);
  const [roadmapData, setRoadmapData] = useState<ClientRoadmap | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | undefined>(undefined);
  const [goalData, setGoalData] = useState<ClientGoal | null>(null);

  useEffect(() => {
    clientSafeGetRoadmaps()
      .then(setRoadmapList)
      .catch(() => {
        setRoadmapList([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedRoadmap) {
      setRoadmapData(null);
      setSelectedGoal(undefined);
      console.warn("No roadmap selected, skipping fetch.");
      return;
    }
    clientSafeGetOneRoadmap(selectedRoadmap)
      .then(setRoadmapData)
      .catch(() => {
        setRoadmapData(null);
      });
  }, [selectedRoadmap]);

  useEffect(() => {
    if (!selectedGoal) {
      setGoalData(null);
      console.warn("No goal selected, skipping fetch.");
      return;
    }
    clientSafeGetOneGoal(selectedGoal)
      .then(setGoalData)
      .catch(() => {
        setGoalData(null);
      });
  }, [selectedGoal]);

  return (
    <>
      {/* Roadmap select */}
      <label className="block margin-block-75">
        {t("forms:goal.select_roadmap_version")}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required={true}
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined); }}
        >
          <option value="">{t("forms:goal.select_roadmap_version")}</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {/* Goal select */}
      {roadmapData ? <label className="block margin-block-75">
        {t("forms:goal.select_goal_as_baseline")}
        <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required={true}
          value={selectedGoal}
          onChange={(e) => setSelectedGoal(e.target.value)}
        >
          <option value="">{t("forms:goal.select_goal")}</option>
          {roadmapData?.goals.map((goal) => (
            <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
              {`${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing")})`}
            </option>
          ))}
        </select>
      </label> : null
      }

      {goalData ? <label className="block margin-block-75">
        {t("forms:goal.baseline_copied")}
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