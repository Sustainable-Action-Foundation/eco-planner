import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/form/forms/goal";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { notFound } from "next/navigation";
import type { AccessControlled } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { getOneGoal, getRoadmaps } from "@/fetchers";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ goalId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const [t, session, currentGoal] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneGoal(params.goalId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/goal/${params.goalId}/edit`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: `${t("metadata:goal_edit.title")} ${currentGoal?.name}`,
    description: currentGoal?.description,
    og_url: `/goal/${params.goalId}/edit`,
    og_image_url: undefined, // TODO METADATA: Use graph api here once ready
  });
}

export default async function Page(props: { params: Promise<{ goalId: string }> }) {
  const params = await props.params;
  const [t, accessContext, currentGoal, roadmaps] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneGoal(params.goalId),
    getRoadmaps(),
  ]);

  let goalAccessData: AccessControlled | null = null;
  if (currentGoal) {
    goalAccessData = {
      access_control: currentGoal.roadmap_iteration.roadmap.access_control,
      published_at: currentGoal.roadmap_iteration.published_at,
    };
  }
  // User must be signed in and have edit access to the goal, and the goal must exist
  if (!currentGoal || !accessContext || !hasEditAccess(accessChecker(goalAccessData, accessContext))) {
    return notFound();
  }

  const roadmapList = roadmaps.filter((roadmap) => hasEditAccess(accessChecker(roadmap, accessContext)));

  return (
    <>
      <Breadcrumb object={currentGoal} customSections={[t("pages:goal_edit.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:goal_edit.title", {
            goalName: currentGoal.name ? currentGoal.name : currentGoal.indicator_parameter,
          })}
        </h1>
        <GoalForm
          iterationId={currentGoal.roadmap_iteration_id}
          currentGoal={currentGoal}
          roadmapAlternatives={roadmapList}
        />
      </div>
    </>
  );
}