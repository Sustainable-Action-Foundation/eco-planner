import getOneGoal from "@/fetchers/getOneGoal";
import getRoadmapSubset from "@/fetchers/getRoadmapSubset";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalTable from "../tables/goalTables/goalTable";
import RoadmapTable from "../tables/roadmapTables/roadmapTable";
import ActionTable from "../tables/actions";
import getOneAction from "@/fetchers/getOneAction";

export default async function DashboardBase({ actor }: { actor: string }) {
  const [session, roadmaps] = await Promise.all([
    getSession(cookies()),
    getRoadmapSubset(actor)
  ]);

  const goalIds: string[] = []
  const actionIds: string[] = []
  for (const roadmap of roadmaps) {
    for (const goal of roadmap.goals) {
      goalIds.push(goal.id)
    }
    for (const action of roadmap.actions) {
      actionIds.push(action.id)
    }
  }

  let goals: Exclude<Awaited<ReturnType<typeof getOneGoal>>, null>[] = [];
  let actions: Exclude<Awaited<ReturnType<typeof getOneAction>>, null>[] = [];

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

    // Get all actions and filter out any null values
    actions = (await Promise.all(actionIds.map(
      async (goalId) => {
        try {
          const action = await getOneAction(goalId);
          return action;
        } catch {
          return null;
        }
      }
    ))).filter((action): action is Exclude<typeof action, null> => action != null)
  }

  return <>
    <RoadmapTable roadmaps={roadmaps} user={session.user} />
    <GoalTable goals={goals} />
    <ActionTable actions={actions} />
  </>
}