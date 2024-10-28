import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/forms/actionForm/actionForm";
import { notFound } from "next/navigation";
import accessChecker from "@/lib/accessChecker";
import getOneGoal from "@/fetchers/getOneGoal";
import { AccessControlled, AccessLevel } from "@/types";

export default async function Page({
  searchParams
}: {
  searchParams: {
    roadmapId?: string | string[] | undefined,
    goalId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
  const [session, goal] = await Promise.all([
    getSession(cookies()),
    getOneGoal(typeof searchParams.goalId == 'string' ? searchParams.goalId : '')
  ]);

  let goalAccessData: AccessControlled | null = null;
  if (goal) {
    goalAccessData = {
      author: goal.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic
    }
  }
  // User must be signed in, and have edit access to the goal if it exists
  if (
    !session.user ||
    (!goal && typeof searchParams.goalId == 'string') ||
    (goal && (
      !accessChecker(goalAccessData, session.user) ||
      accessChecker(goalAccessData, session.user) === AccessLevel.View
    ))
  ) {
    return notFound();
  }

  return (
    <>
      <div className="container-text" style={{ marginInline: 'auto' }}>
        {goal ?
          <h1>Skapa ny åtgärd under målbana: {`${goal?.name || goal?.indicatorParameter}`}</h1>
          :
          <h1>Skapa ny åtgärd</h1>
        }
        <ActionForm
          goalId={typeof searchParams.goalId == 'string' ? searchParams.goalId : undefined}
          roadmapId={typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : undefined}
        />
      </div>
    </>
  )
}