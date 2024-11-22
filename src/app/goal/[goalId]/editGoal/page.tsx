import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import accessChecker from "@/lib/accessChecker";
import { notFound } from "next/navigation";
import getOneGoal from "@/fetchers/getOneGoal";
import { AccessControlled, AccessLevel } from "@/types";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";


export default async function Page({ params }: { params: { goalId: string } }) {
  const [session, currentGoal, roadmaps] = await Promise.all([
    getSession(cookies()),
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
      <Breadcrumb object={currentGoal} customSections={['Redigera målbana']} />

      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Redigera målbana: {currentGoal.name ? currentGoal.name : currentGoal.indicatorParameter}</h1>
        <GoalForm roadmapId={currentGoal.roadmapId} currentGoal={currentGoal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}