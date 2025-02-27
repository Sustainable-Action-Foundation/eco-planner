'use client';

import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import { useContext, useEffect, useState } from "react";
import type getOneAction from "@/fetchers/getOneAction.ts";
import type getOneGoal from "@/fetchers/getOneGoal";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import parentDict from "../forms.dict.json" with { type: "json" };
import { LocaleContext } from "@/app/context/localeContext.tsx";


export function ActionSelector({
  action,
  roadmapAlternatives,
}: {
  action: Awaited<ReturnType<typeof getOneAction>> | null,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
  const dict = parentDict.effectForm.effectFormSections;
  const locale = useContext(LocaleContext);

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
        {dict.actionSelector.selectRoadmapVersion.title[locale]}
        <select name="selectedActionRoadmap" className="block margin-block-25" required disabled={!!action}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedAction(""); }}
        >
          <option value="" disabled>{dict.actionSelector.selectRoadmapVersion.selectRoadmapVersion[locale]}</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`action-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} ${dict.actionSelector.selectRoadmapVersion.actions[locale]}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-100">
          {dict.actionSelector.selectAction.title[locale]}
          <select name="actionId" id="actionId" className="block margin-block-25" required disabled={!!action}
            value={action?.id || selectedAction}
            onChange={event => setSelectedAction(event.target.value)}
          >
            <option value="" disabled>{dict.actionSelector.selectAction.selectAction[locale]}</option>
            {roadmapData?.actions.map(action => (
              <option key={`action-selector${action.id}`} value={action.id}>
                {`${action.name}; ${action._count.effects} ${dict.actionSelector.selectAction.existingEffects[locale]}`}
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
  const dict = parentDict.effectForm.effectFormSections;
  const locale = useContext(LocaleContext);

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
        {dict.goalSelector.selectRoadmapVersion.title[locale]}
        <select name="selectedGoalRoadmap" className="block margin-block-25" required disabled={!!goal}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled>{dict.goalSelector.selectRoadmapVersion.selectRoadmapVersion[locale]}</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} ${dict.goalSelector.selectRoadmapVersion.goals[locale]}`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-75">
          {dict.goalSelector.selectRoadmap.title[locale]}
          <select name="goalId" id="goalId" className="block margin-block-25" required disabled={!!goal}
            value={goal?.id || selectedGoal}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled>{dict.goalSelector.selectRoadmap.selectRoadmap[locale]}</option>
            {roadmapData?.goals.map(goal => (
              <option key={`goal-selector${goal.id}`} value={goal.id}>
                {`${goal.name ?? dict.goalSelector.selectRoadmap.namelessGoal[locale]}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || dict.goalSelector.selectRoadmap.unitMissing[locale]})`}
              </option>
            ))}
          </select>
        </label>
      }
    </>
  );
}