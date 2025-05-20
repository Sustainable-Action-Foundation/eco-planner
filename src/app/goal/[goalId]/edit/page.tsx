import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import accessChecker from "@/lib/accessChecker";
import { notFound } from "next/navigation";
import getOneGoal from "@/fetchers/getOneGoal";
import { AccessControlled, AccessLevel } from "@/types";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { t } from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { baseUrl } from "@/lib/baseUrl";

export async function generateMetadata(props: { params: Promise<{ goalId: string }> }){
  const params = await props.params;
  const [currentGoal] = await Promise.all([
    getOneGoal(params.goalId),
  ]);

  return buildMetadata({
    title: `Redigera målbana: ${currentGoal?.name}`,
    description: currentGoal?.description,
    image_url: `${baseUrl}/api/graph/${currentGoal?.id}`, // TODO: Custom image?
    og_url: `/goal/${currentGoal?.id}/edit`
  }) 
}

export default async function Page(props: { params: Promise<{ goalId: string }> }) {
  const params = await props.params;
  const [session, currentGoal, roadmaps] = await Promise.all([
    getSession(await cookies()),
    getOneGoal(params.goalId),
    getRoadmaps(),
  ]);

  let goalAccessData: AccessControlled | null = null;
  if (currentGoal) {
    goalAccessData = {
      author: currentGoal.author,
      editors: currentGoal.roadmap.editors,
      viewers: currentGoal.roadmap.viewers,
      editGroups: currentGoal.roadmap.editGroups,
      viewGroups: currentGoal.roadmap.viewGroups,
      isPublic: currentGoal.roadmap.isPublic
    }
  }
  // User must be signed in and have edit access to the goal, and the goal must exist
  if (!currentGoal || !session.user || !accessChecker(goalAccessData, session.user) || accessChecker(goalAccessData, session.user) === AccessLevel.View) {
    return notFound();
  }

  const roadmapList = roadmaps.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={currentGoal} customSections={[t("pages:goal_edit.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:goal_edit.title", { 
            goalName: currentGoal.name ? currentGoal.name : currentGoal.indicatorParameter
          })}
        </h1>
        <GoalForm roadmapId={currentGoal.roadmapId} currentGoal={currentGoal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}