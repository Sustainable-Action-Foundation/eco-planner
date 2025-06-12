import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import { AccessLevel } from "@/types";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";

export async function generateMetadata() {
  const t = await serveTea("metadata")

  return buildMetadata({
    title: t("metadata:goal_create.title"),
    description: t("metadata:goal_create.title"),
    og_url: `/goal/create`,
    og_image_url: undefined,
  })
}

export default async function Page(
  props: {
    searchParams: Promise<{
      roadmapId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  }
) {
  const searchParams = await props.searchParams;
  const [t, session, roadmap, roadmapList] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
    getRoadmaps(),
  ]);

  // Ignore the roadmap (and inform user) if it is not found or the user does not have edit access
  const badRoadmap = (
    (!roadmap && typeof searchParams.roadmapId == 'string') ||
    (roadmap && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user))))
  );

  const filteredRoadmaps = roadmapList.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={roadmap || undefined} customSections={[t("pages:goal_create.breadcrumb")]} />
      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:goal_create.title")}
        </h1>
        {badRoadmap &&
          <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:goal_create.information_icon_aria")}/>
            {t("pages:goal_create.bad_roadmap")}
          </p>
        }
        <GoalForm roadmapId={badRoadmap ? undefined : searchParams.roadmapId as string} roadmapAlternatives={filteredRoadmaps} />
      </div>
    </>
  )
}