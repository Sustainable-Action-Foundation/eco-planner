'use client';

import { clientSafeGetOneGoal } from "@/fetchers/getOneGoal";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import { clientSafeGetRoadmaps } from "@/fetchers/getRoadmaps";
import { useEffect, useState } from "react";

// TODO: Allow passing proper actions/goals in addition to/instead of IDs?
// Would be nice if we fetched serverside before rendering the form, could do better access control as well

export function ActionSelector({
  actionId,
}: {
  actionId?: string,
}) {/*
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof clientSafeGetRoadmaps>>>([]);

  const [currentActionId, setCurrentActionId] = useState<string | undefined>(undefined);
  const [roadmapId, setRoadmapId] = useState<string | undefined>(undefined);
  // Types based on clientSafeGetOneAction and clientSafeGetOneRoadmap
  const [roadmap, setRoadmap] = useState<unknown | undefined>(undefined);

  useEffect(() => {
    clientSafeGetRoadmaps().then(setRoadmapList);
  }, []);

  // Initial fetch if actionId is provided
  useEffect(() => {
    if (actionId) {
      clientSafeGetOneAction(actionId).then(action => {
        if (action) {
          setCurrentActionId(action.id);
          setRoadmapId(action.roadmapId);
          // Avoid running another effect if action.id == currentActionId
          setAction(action);
        } else {
          console.log("Action not found");
        }
      });
    }
  }, [actionId]);
*/
  return (
    <></>
  );
}

export function GoalSelector({
  goalId,
}: {
  goalId?: string,
}) {
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof clientSafeGetRoadmaps>>>([]);

  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>("");

  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>> | null>(null);

  // Get list of available roadmaps
  useEffect(() => {
    clientSafeGetRoadmaps().then(setRoadmapList);
  }, []);

  // Initial fetch if goalId is provided
  useEffect(() => {
    if (goalId) {
      clientSafeGetOneGoal(goalId).then(goal => {
        if (goal) {
          setSelectedGoal(goal.id);
          setSelectedRoadmap(goal.roadmapId);
        } else {
          alert("Angivet mål hittades inte");
        }
      }).catch(() => {
        alert("Ett fel uppstod när målet skulle hämtas");
      });
    }
  }, [goalId]);

  useEffect(() => {
    clientSafeGetOneRoadmap(selectedRoadmap).then(setRoadmapData);
  }, [selectedRoadmap]);

  return (
    <>
      <label className="block margin-block-75">
        Välj färdplanen målbanan ligger under:
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required disabled={!!goalId}
          value={selectedRoadmap}
          onChange={event => { setSelectedRoadmap(event.target.value); setSelectedGoal(""); }}
        >
          <option value="" disabled>Välj färdplan</option>
          {roadmapList.map(roadmap => (
            // Disable selecting a different roadmap if a goal is preselected (for example when goalId is specified in the URL query)
            <option key={`goal-selector${roadmap.id}`} value={roadmap.id}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          Välj målbana att påverka:
          <select name="goalId" id="goalId" className="margin-inline-25" required disabled={!!goalId}
            value={goalId || selectedGoal}
            onChange={event => setSelectedGoal(event.target.value)}
          >
            <option value="" disabled>Välj målbana</option>
            {roadmapData.goals.map(goal => (
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