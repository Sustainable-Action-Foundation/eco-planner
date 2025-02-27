import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/forms/actionForm/actionForm";
import { notFound } from "next/navigation";
import accessChecker from "@/lib/accessChecker";
import getOneAction from "@/fetchers/getOneAction";
import { AccessControlled, AccessLevel } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getServerLocale } from "@/functions/serverLocale";
import parentDict from "../../action.dict.json" with { type: "json" };

export default async function Page({ params, }: { params: { actionId: string }, }) {
  const dict = parentDict["[actionId]"].edit.page;
  const locale = await getServerLocale();

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
      <Breadcrumb object={action} customSections={[`${dict.breadcrumbEditAction[locale]}`]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {`
          ${dict.editAction[locale]} ${action.name} 
          ${dict.ofRoadmap[locale]} ${action.roadmap.metaRoadmap.name}
          ${dict.ofRoadmapVersion[locale]} ${`v${action.roadmap.version}` || "ERROR"}
          `.trim()}
        </h1>
        <ActionForm roadmapId={action.roadmapId} currentAction={action} roadmapAlternatives={[]} />
      </div>
    </>
  )
}