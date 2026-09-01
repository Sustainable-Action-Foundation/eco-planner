import GoalForm from "@/components/form/forms/goal";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";
import { getOneRoadmapIteration, getRoadmaps } from "@/fetchers";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:goal_create.title"),
    description: t("metadata:goal_create.title"),
    og_url: `/goal/create`,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: {
    searchParams: Promise<{
      iterationId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  },
) {
  const searchParams = await props.searchParams;
  const [t, accessContext, iteration, roadmapList] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneRoadmapIteration(typeof searchParams.iterationId == 'string' ? searchParams.iterationId : ''),
    getRoadmaps(),
  ]);

  // Ignore the iteration (and inform user) if it is not found or the user does not have edit access
  const badRoadmap = (
    (!iteration && typeof searchParams.iterationId == 'string') ||
    (iteration && !hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, status: iteration.status }, accessContext)))
  );

  const filteredRoadmaps = roadmapList.filter((roadmap) => hasEditAccess(accessChecker(roadmap, accessContext)));

  return (
    <>
      <Breadcrumb object={iteration ?? undefined} customSections={[t("pages:goal_create.breadcrumb")]} />
      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:goal_create.title")}
        </h1>
        {badRoadmap ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:goal_create.information_icon_aria")} />
            {t("pages:goal_create.bad_roadmap")}
          </p> : null
        }
        <GoalForm iterationId={badRoadmap ? undefined : searchParams.iterationId as string} roadmapAlternatives={filteredRoadmaps} />
      </div>
    </>
  );
}
