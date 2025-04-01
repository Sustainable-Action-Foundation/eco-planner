'use client';

import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import { useEffect, useState } from "react";
import type getOneAction from "@/fetchers/getOneAction.ts";
import type getOneGoal from "@/fetchers/getOneGoal";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { dataSeriesDataFieldNames } from "@/types.ts";
import { useTranslation } from "react-i18next";

export function ActionSelector({
  action,
  roadmapAlternatives,
}: {
  action: Awaited<ReturnType<typeof getOneAction>> | null,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
  const { t } = useTranslation();
  const [selectedAction, setSelectedAction] = useState<string>(action?.id || "");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(action?.roadmapId || "");

  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>> | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmap(selectedRoadmap).then(setRoadmapData);
    } else {
      setRoadmapData(null);
    }
  }, [selectedRoadmap]);

  return (
    <>
      <label className="block margin-block-100">
        {t("forms:effect.select_roadmap_version_for_action")}
        <select name="selectedActionRoadmap" className="block margin-block-25" required disabled={!!action}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedAction(""); }}
        >
          <option value="" disabled>{t("forms:effect.select_roadmap_version")}</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`action-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("forms:effect.action_count", { count: roadmap._count.actions })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-100">
          {t("forms:effect.select_action_for_effect")}
          <select name="actionId" id="actionId" className="block margin-block-25" required disabled={!!action}
            value={action?.id || selectedAction}
            onChange={event => setSelectedAction(event.target.value)}
          >
            <option value="" disabled>{t("forms:effect.select_action")}</option>
            {roadmapData?.actions.map(action => (
              <option key={`action-selector${action.id}`} value={action.id}>
                {`${action.name}; ${t("forms:effect.existing_effects", { count: action._count.effects })}`}
              </option>
            ))}
          </select>
        </label>
      }
    </>
  );
}

export function GoalSelector({
  goal,
  roadmapAlternatives,
}: {
  goal: Awaited<ReturnType<typeof getOneGoal>> | null,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
  const { t } = useTranslation();
  const [selectedGoal, setSelectedGoal] = useState<string>(goal?.id || "");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(goal?.roadmapId || "");

  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>> | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmap(selectedRoadmap).then(setRoadmapData);
    } else {
      setRoadmapData(null);
    }
  }, [selectedRoadmap]);

  return (
    <>
      <label className="block margin-block-100">
        {t("forms:effect.select_roadmap_version_for_goal")}
        <select name="selectedGoalRoadmap" className="block margin-block-25" required disabled={!!goal}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled>{t("forms:effect.select_roadmap_version")}</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("forms:effect.goal_count", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-75">
          {t("forms:effect.select_goal_to_affect")}
          <select name="goalId" id="goalId" className="block margin-block-25" required disabled={!!goal}
            value={goal?.id || selectedGoal}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled>{t("forms:effect.select_goal")}</option>
            {roadmapData?.goals.map(goal => (
              <option key={`goal-selector${goal.id}`} value={goal.id}>
                {`${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
      }
    </>
  );
}

export function absoluteToDelta(absoluteDataSeries: string): string {
  const deltaArray = absoluteDataSeries.split(/[\t;]/).map((value, index, array) => {
    if (index === 0) {
      return value || '0';
    } else {
      const deltaValue = (parseFloat(value) || 0) - (parseFloat(array[index - 1]) || 0);
      return Number.isFinite(deltaValue) ? deltaValue.toString() : '0';
    }
  })

  // Pad end of array
  if (deltaArray.length < dataSeriesDataFieldNames.length) {
    // In the database the array would be padded with null-values if a short array were to be sent. This is basically equivalent to padding with zeros, but zero-padding is more user-friendly.
    // In order to replicate the result of sending a short absolute array, we need to subtract the last number (setting total delta to 0) and then fill the rest of the array with zeros.
    const lastNumber = absoluteDataSeries.split(/[\t;]/).pop();
    deltaArray.push(`${lastNumber ? (-parseFloat(lastNumber) || 0).toString() : '0'}`);

    while (deltaArray.length < dataSeriesDataFieldNames.length) {
      deltaArray.push('0');
    }
  }
  return deltaArray.join(';');
}

export function deltaToAbsolute(deltaDataSeries: string): string {
  const absoluteArray = deltaDataSeries.split(/[\t;]/).map((value, index, array) => {
    if (index === 0) {
      return value || '0';
    } else {
      const absoluteValue = array.slice(0, index + 1).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
      return Number.isFinite(absoluteValue) ? absoluteValue.toString() : '0';
    }
  })

  // Pad end of array
  if (absoluteArray.length < dataSeriesDataFieldNames.length) {
    // In the database the array would be padded with null-values if a short array were to be sent. This is basically equivalent to padding with zeros, but zero-padding is more user-friendly.
    // In order to replicate the result of sending a short delta array, we need to fill the rest of the array with the last number in the array (no delta).
    const lastNumber = absoluteArray.slice(-1)[0];
    while (absoluteArray.length < dataSeriesDataFieldNames.length) {
      absoluteArray.push(lastNumber || '0');
    }
  }
  return absoluteArray.join(';');
}