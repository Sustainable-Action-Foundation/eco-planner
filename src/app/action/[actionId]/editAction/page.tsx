import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/forms/actionForm/actionForm";
import { notFound } from "next/navigation";
import accessChecker from "@/lib/accessChecker";
import getOneAction from "@/fetchers/getOneAction";
import { AccessControlled, AccessLevel } from "@/types";

export default async function Page({
  params,
}: {
  params: { actionId: string },
}) {
  const [session, action] = await Promise.all([
    getSession(cookies()),
    getOneAction(params.actionId)
  ]);

  let actionAccessData: AccessControlled | null = null;
  if (action) {
    actionAccessData = {
      author: action.author,
      editors: action.roadmap.editors,
      viewers: action.roadmap.viewers,
      editGroups: action.roadmap.editGroups,
      viewGroups: action.roadmap.viewGroups,
      isPublic: action.roadmap.isPublic
    }
  }

  // User must be signed in and have edit access to the action, and the action must exist
  if (!action || !session.user || !accessChecker(actionAccessData, session.user) || accessChecker(actionAccessData, session.user) === AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <div className="container-text">
        <h1>Redigera åtgärd: {`${action.name} under färdplan: ${action.roadmap.metaRoadmap.name || "ERROR"}`}</h1>
        <ActionForm roadmapId={action.roadmapId} currentAction={action} roadmapAlternatives={[]} />
      </div>
    </>
  )
}