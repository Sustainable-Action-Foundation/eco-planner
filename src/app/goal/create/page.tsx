import GoalForm from "@/components/form/forms/goal";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";
import { getOneRoadmapIteration, getRoadmaps } from "@/fetchers";
import { getPrefilledSeries } from "@/fetchers/resolveSeriesRef";
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
      /** A series ref to start the goal from, resolved for the org's geo area (see `getPrefilledSeries`) */
      series?: string | string[] | undefined,
      org?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  },
) {
  const searchParams = await props.searchParams;
  const t = await serveTea("pages");
  const [accessContext, iteration, roadmapList, { series: prefill, failed: badPrefill }] = await Promise.all([
    getUserAccessContext(),
    getOneRoadmapIteration(typeof searchParams.iterationId == 'string' ? searchParams.iterationId : ''),
    getRoadmaps(),
    getPrefilledSeries(t, searchParams),
  ]);

  // Ignore the iteration (and inform user) if it is not found or the user does not have edit access
  const badRoadmap = (
    (!iteration && typeof searchParams.iterationId == 'string') ||
    (iteration && !hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext)))
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
        {badPrefill ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:goal_create.information_icon_aria")} />
            {t("pages:goal_create.bad_prefill")}
          </p> : null
        }
        {prefill ? <p className="color-gray">
            <IconInfoCircle role="img" aria-label={t("pages:goal_create.information_icon_aria")} />
            {t("pages:goal_create.prefilled", { name: prefill.name })}
          </p> : null
        }
        <GoalForm iterationId={badRoadmap ? undefined : searchParams.iterationId as string} roadmapAlternatives={filteredRoadmaps} prefill={prefill ?? undefined} />
      </div>
    </>
  );
}
