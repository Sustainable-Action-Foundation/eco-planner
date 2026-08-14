'use client';

import { clientSafeGetOneRoadmapIteration } from "@/fetchers/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Action, ClientRoadmapIteration, DateValuesWithUnit, Goal, MultiRoadmapInstance } from "@/types";
import { EffectFormName } from "@/types/form-names";
import { isISOIshDate } from "@/types/typeguards";

export function ActionSelector({
  action,
  roadmaps,
}: {
  // Only identity fields are read here, so accept any object carrying them
  // (a full Action, or the trimmed action on an Effect). Avoids demanding — and
  // therefore serializing — the whole Action to the client.
  action: Pick<Action, "id" | "roadmap_iteration_id"> | null,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation("forms");
  const [selectedAction, setSelectedAction] = useState<string>(action?.id ?? "");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(action?.roadmap_iteration_id ?? "");

  const [roadmapData, setRoadmapData] = useState<ClientRoadmapIteration | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmapIteration(selectedRoadmap).then(setRoadmapData).catch(() => {
        setRoadmapData(null);
      });
    } else {
      setRoadmapData(null);
    }
  }, [selectedRoadmap]);

  return (
    <>
      <label>
        {t("forms:effect.select_roadmap_version_for_action")}
        <select name="selectedActionRoadmap" className="block margin-top-25 margin-bottom-100 width-100" required={true}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedAction(""); }}
        >
          <option value="" disabled={true}>{t("forms:effect.select_roadmap_version")}</option>
          {roadmaps.map(roadmapOption => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`action-selector${roadmapOption.id}`} value={roadmapOption.id} disabled={!!action && roadmapOption.id !== action.roadmap_iteration_id}>
              {`${roadmapOption.roadmap.name} (v${roadmapOption.version}): ${t("common:count.action", { count: roadmapOption._count.actions })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap ? <label>
          {t("forms:effect.select_action_for_effect")}
          <select name={EffectFormName.ActionId} id="actionId" className="block margin-top-25 margin-bottom-100 width-100" required={true}
            value={action?.id || selectedAction}
            onChange={event => setSelectedAction(event.target.value)}
          >
            <option value="" disabled={true}>{t("forms:effect.select_action")}</option>
            {roadmapData?.actions.map(actionOption => (
              <option key={`action-selector${actionOption.id}`} value={actionOption.id} disabled={!!action && actionOption.id !== action.id}>
                {`${actionOption.name}; ${t("forms:effect.existing_effects", { count: actionOption._count.effects })}`}
              </option>
            ))}
          </select>
        </label> : null
      }
    </>
  );
}

export function GoalSelector({
  goal,
  roadmaps,
}: {
  // Only identity fields are read here, so accept any object carrying them
  // (a full Goal, or the trimmed goal on an Effect).
  goal: Pick<Goal, "id" | "roadmap_iteration_id"> | null,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(goal?.id ?? null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(goal?.roadmap_iteration_id ?? null);

  const [roadmapData, setRoadmapData] = useState<ClientRoadmapIteration | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmapIteration(selectedRoadmap).then(setRoadmapData).catch(() => {
        setRoadmapData(null);
      });
    } else {
      setRoadmapData(null);
    }
  }, [selectedRoadmap]);

  return (
    <>
      <label>
        {t("forms:effect.select_roadmap_version_for_goal")}
        <select name="selectedGoalRoadmap" className="block margin-top-25 margin-bottom-100 width-100" required={true}
          value={selectedRoadmap ?? ""}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled={true}>{t("forms:effect.select_roadmap_version")}</option>
          {roadmaps.map(roadmapOption => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmapOption.id}`} value={roadmapOption.id} disabled={!!goal && roadmapOption.id !== goal.roadmap_iteration_id}>
              {`${roadmapOption.roadmap.name} (v${roadmapOption.version}): ${t("common:count.goal", { count: roadmapOption._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap ? <label>
          {t("forms:effect.select_goal_to_affect")}
          <select name={EffectFormName.GoalId} id="goalId" className="block margin-top-25 margin-bottom-100 width-100" required={true}
            value={goal?.id ?? selectedGoal ?? ""}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled={true}>{t("forms:effect.select_goal")}</option>
            {roadmapData?.goals.map(goalOption => (
              <option key={`goal-selector${goalOption.id}`} value={goalOption.id} disabled={!!goal && goalOption.id !== goal.id}>
                {`${goalOption.name ?? t("forms:effect.unnamed_goal")}: ${goalOption.indicator_parameter} (${goalOption.data_series?.unit === null ? t("common:tsx.unitless") : goalOption.data_series?.unit || t("common:tsx.unit_missing")})`}
              </option>
            ))}
          </select>
        </label> : null
      }
    </>
  );
}

/** 
 * TODO! handle sparse input
 * 
 * Right now, it works, but it will do undesirable things if the input is sparse.
 */
export function absoluteToDelta(absoluteDataSeries: DateValuesWithUnit): DateValuesWithUnit {
  const delta: DateValuesWithUnit = { dateValues: {}, unit: absoluteDataSeries.unit };
  let previousValue = 0;
  for (const [date, value] of Object.entries(absoluteDataSeries.dateValues)) {
    if (!isISOIshDate(date)) throw new Error(`Invalid date format: ${date}`);

    delta.dateValues[date] = value - previousValue;
    previousValue = value;
  }
  return delta;
}

/**
 * TODO! handle sparse input
 * 
 * Right now, it works, but it will do undesirable things if the input is sparse.
 */
export function deltaToAbsolute(deltaDataSeries: DateValuesWithUnit): DateValuesWithUnit {
  const absolute: DateValuesWithUnit = { dateValues: {}, unit: deltaDataSeries.unit };
  let cumulativeValue = 0;
  for (const [date, value] of Object.entries(deltaDataSeries.dateValues)) {
    if (!isISOIshDate(date)) throw new Error(`Invalid date format: ${date}`);

    cumulativeValue += value;
    absolute.dateValues[date] = cumulativeValue;
  }
  return absolute;
}