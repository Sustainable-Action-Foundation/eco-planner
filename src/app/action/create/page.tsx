import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/forms/actionForm/actionForm";
import Image from "next/image";
import accessChecker from "@/lib/accessChecker";
import getOneGoal from "@/fetchers/getOneGoal";
import { AccessControlled, AccessLevel } from "@/types";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { baseUrl } from "@/lib/baseUrl";

export async function generateMetadata() {
  const t = await serveTea("metadata")

  return buildMetadata({
    title: t("metadata:action_create.title"),
    description: t("metadata:action_create.description"),
    og_url: `${baseUrl}/action/create`,
    og_image_url: undefined
  })
}

export default async function Page(
  props: {
    searchParams: Promise<{
      roadmapId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  }
) {
  const searchParams = await props.searchParams;
  const [t, session, goal, roadmap, roadmapList] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneGoal(typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
    getRoadmaps(),
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

  // Ignore the goal or roadmap (and inform user) if they are not found or the user does not have edit access
  const badGoal = (
    (!goal && typeof searchParams.goalId == 'string') ||
    (goal && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(goalAccessData, session.user))))
  );
  const badRoadmap = (
    (!roadmap && typeof searchParams.roadmapId == 'string') ||
    (roadmap && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user))))
  );

  // The roadmaps the user can choose to add the action to (the ones they have edit access to)
  const availableRoadmaps = roadmapList.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={goal || roadmap || undefined} customSections={[t("pages:action_create.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        {goal ?
          <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
            {t("pages:action_create.title_with_goal", { goalName: goal?.name || goal?.indicatorParameter })}
          </h1>
          :
          <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
            {t("pages:action_create.title")}
          </h1>
        }
        {badGoal &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {t("pages:action_create.bad_goal")}
          </p>
        }
        {badRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {t("pages:action_create.bad_roadmap")}
          </p>
        }
        <ActionForm
          goalId={badGoal ? undefined : searchParams.goalId as string | undefined}
          roadmapId={badRoadmap ? undefined : searchParams.roadmapId as string | undefined}
          roadmapAlternatives={availableRoadmaps}
        />
      </div>
    </>
  )
}