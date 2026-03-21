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
        <select name="selectedActionRoadmap" className="block margin-top-25 margin-bottom-100 width-100" required disabled={!!action}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedAction(""); }}
        >
          <option value="" disabled>{t("forms:effect.select_roadmap_version")}</option>
          {roadmaps.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`action-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.action", { count: roadmap._count.actions })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label>
          {t("forms:effect.select_action_for_effect")}
          <select name="actionId" id="actionId" className="block margin-top-25 margin-bottom-100 width-100" required disabled={!!action}
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
        <select name="selectedGoalRoadmap" className="block margin-top-25 margin-bottom-100 width-100" required disabled={!!goal}
          value={selectedRoadmap ?? ""}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled>{t("forms:effect.select_roadmap_version")}</option>
          {roadmaps.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label>
          {t("forms:effect.select_goal_to_affect")}
          <select name="goalId" id="goalId" className="block margin-top-25 margin-bottom-100 width-100" required disabled={!!goal}
            value={goal?.id ?? selectedGoal ?? ""}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled>{t("forms:effect.select_goal")}</option>
            {roadmapData?.goals.map(goal => (
              <option key={`goal-selector${goal.id}`} value={goal.id}>
                {`${goal.name ?? t("forms:effect.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
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