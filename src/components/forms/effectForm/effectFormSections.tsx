'use client';

import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import { useEffect, useState } from "react";
import type getOneAction from "@/fetchers/getOneAction.ts";
import type getOneGoal from "@/fetchers/getOneGoal";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";

export function ActionSelector({
  action,
  roadmapAlternatives,
}: {
  action: Awaited<ReturnType<typeof getOneAction>> | null,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
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
        Välj färdplansversion som åtgärden ligger under
        <select name="selectedActionRoadmap" className="block margin-block-25" required disabled={!!action}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedAction(""); }}
        >
          <option value="" disabled>Välj färdplansversion</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`action-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} åtgärder`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-100">
          Välj åtgärd att lägga effekten under
          <select name="actionId" id="actionId" className="block margin-block-25" required disabled={!!action}
            value={action?.id || selectedAction}
            onChange={event => setSelectedAction(event.target.value)}
          >
            <option value="" disabled>Välj åtgärd</option>
            {roadmapData?.actions.map(action => (
              <option key={`action-selector${action.id}`} value={action.id}>
                {`${action.name}; ${action._count.effects} existerande effekter`}
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
        Välj färdplansversionen som målbanan ligger under
        <select name="selectedGoalRoadmap" className="block margin-block-25" required disabled={!!goal}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled>Välj färdplansversion</option>
          {roadmapAlternatives.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} målbanor`}
            </option>
          ))}
        </select>
      </label>

      {selectedRoadmap &&
        <label className="block margin-block-75">
          Välj målbana att påverka
          <select name="goalId" id="goalId" className="block margin-block-25" required disabled={!!goal}
            value={goal?.id || selectedGoal}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled>Välj målbana</option>
            {roadmapData?.goals.map(goal => (
              <option key={`goal-selector${goal.id}`} value={goal.id}>
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </option>
            ))}
          </select>
        </label>
      }
    </>
  );
}