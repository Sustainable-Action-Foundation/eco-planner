import getOneGoal from "@/fetchers/getOneGoal";
import getRoadmapSubset from "@/fetchers/getRoadmapSubset";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalTable from "../tables/goalTables/goalTable";
import { Action } from "@prisma/client";
import RoadmapTable from "../tables/roadmapTable";
import ActionTable from "../tables/actions";

export default async function DashboardBase({ actor }: { actor: string }) {
  const [session, roadmaps] = await Promise.all([
    getSession(cookies()),
    getRoadmapSubset(actor)
  ]);

  const goalIds: string[] = []
  for (const roadmap of roadmaps) {
    for (const goal of roadmap.goals) {
      goalIds.push(goal.id)
    }
  }

  let goals: Exclude<Awaited<ReturnType<typeof getOneGoal>>, null>[] = []

  if (roadmaps) {
    // Get all goals and filter out any null values
    goals = (await Promise.all(goalIds.map(
      async (goalId) => {
        try {
          return await getOneGoal(goalId);
        } catch {
          return null;
        }
      }
    ))).filter((goal): goal is Exclude<typeof goal, null> => goal != null)

  }

  // Get a list of actions
  const actions: (Action & { goal: { id: string, roadmap: { id: string } } })[] = [];
  for (const goal of goals) {
    if (!goal) continue;
    for (const action of goal.actions) {
      actions.push({ ...action, goal: { id: goal.id, roadmap: { id: goal.roadmap.id } } })
    }
  }

  return <>
    <RoadmapTable roadmaps={roadmaps} user={session.user} />
    <GoalTable goals={goals} />
    <ActionTable actions={actions} />
  </>
}