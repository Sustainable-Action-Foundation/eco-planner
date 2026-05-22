'use client';

import { clientSafeGetOneRoadmap } from "@/fetchers/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isISOIshDate } from "@/types";
import type { Action, ClientRoadmap, DateValuesWithUnit, Goal, MultiRoadmapInstance } from "@/types";

export function ActionSelector({
  action,
  roadmaps,
}: {
  action: Action | null,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation("forms");
  const [selectedAction, setSelectedAction] = useState<string>(action?.id ?? "");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(action?.roadmapId ?? "");

  const [roadmapData, setRoadmapData] = useState<ClientRoadmap | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmap(selectedRoadmap).then(setRoadmapData).catch(() => {
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
            <option key={`action-selector${roadmapOption.id}`} value={roadmapOption.id} disabled={!!action && roadmapOption.id !== action.roadmapId}>
              {`${roadmapOption.metaRoadmap.name} (v${roadmapOption.version}): ${t("common:count.action", { count: roadmapOption._count.actions })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap ? <label>
          {t("forms:effect.select_action_for_effect")}
          <select name="actionId" id="actionId" className="block margin-top-25 margin-bottom-100 width-100" required={true}
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
  goal: Goal | null,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(goal?.id ?? null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(goal?.roadmapId ?? null);

  const [roadmapData, setRoadmapData] = useState<ClientRoadmap | null>(null);

  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmap(selectedRoadmap).then(setRoadmapData).catch(() => {
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
            <option key={`goal-selector${roadmapOption.id}`} value={roadmapOption.id} disabled={!!goal && roadmapOption.id !== goal.roadmapId}>
              {`${roadmapOption.metaRoadmap.name} (v${roadmapOption.version}): ${t("common:count.goal", { count: roadmapOption._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap ? <label>
          {t("forms:effect.select_goal_to_affect")}
          <select name="goalId" id="goalId" className="block margin-top-25 margin-bottom-100 width-100" required={true}
            value={goal?.id ?? selectedGoal ?? ""}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled={true}>{t("forms:effect.select_goal")}</option>
            {roadmapData?.goals.map(goalOption => (
              <option key={`goal-selector${goalOption.id}`} value={goalOption.id} disabled={!!goal && goalOption.id !== goal.id}>
                {`${goalOption.name ?? t("forms:effect.unnamed_goal")}: ${goalOption.indicatorParameter} (${goalOption.dataSeries?.unit === null ? t("common:tsx.unitless") : goalOption.dataSeries?.unit || t("common:tsx.unit_missing")})`}
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