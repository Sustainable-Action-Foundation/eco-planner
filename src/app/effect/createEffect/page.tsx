import EffectForm from "@/components/forms/effectForm/effectForm.tsx"
import getOneAction from "@/fetchers/getOneAction.ts";
import getOneGoal from "@/fetchers/getOneGoal.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    actionId?: string | string[] | undefined,
    goalId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  },
}) {
  const [session, action, goal, roadmaps] = await Promise.all([
    getSession(cookies()),
    getOneAction(typeof searchParams.actionId == 'string' ? searchParams.actionId : ''),
    getOneGoal(typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getRoadmaps(),
  ]);

  const badAction = (
    (!action && typeof searchParams.actionId == 'string') ||
    (action && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(action.roadmap, session.user))))
  );

  const badGoal = (
    (!goal && typeof searchParams.goalId == 'string') ||
    (goal && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(goal.roadmap, session.user))))
  );

  const roadmapList = roadmaps.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Skapa ny effekt</h1>
        <EffectForm action={badAction ? null : action} goal={badGoal ? null : goal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}