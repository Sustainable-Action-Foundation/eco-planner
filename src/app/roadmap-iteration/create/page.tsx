import { getSession } from '@/lib/session';
import RoadmapIterationForm from '@/components/form/forms/roadmapIteration';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import accessChecker, { hasEditAccess } from '@/lib/accessChecker';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';
import { IconInfoCircle } from '@tabler/icons-react';
import { getOneRoadmap, getRoadmaps, getUserAccessContext } from "@/fetchers";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:roadmap_iteration_create.title"),
    description: t('metadata:roadmap_iteration_create.description'),
    og_url: `/roadmap-iteration/create`,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: {
    searchParams: Promise<{
      roadmapId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  },
) {
  const searchParams = await props.searchParams;
  const [t, session, accessContext, parent, roadmapAlternatives] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getUserAccessContext(),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
    getRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  const badRoadmap = (
    searchParams.roadmapId instanceof Array
    || (!parent && typeof searchParams.roadmapId == 'string')
    || (parent && !hasEditAccess(accessChecker(parent, accessContext)))
  );

  // The roadmaps the user can create the new iteration under (the ones they have edit access to)
  const filteredAlternatives = roadmapAlternatives.filter(roadmap =>
    hasEditAccess(accessChecker(roadmap, accessContext)),
  );

  return (
    <>
      <Breadcrumb object={parent ?? undefined} customSections={[t("pages:roadmap_iteration_create.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_iteration_create.title")}
        </h1>
        {badRoadmap ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:roadmap_iteration_create.information_icon_aria")} />
            {t("pages:roadmap_iteration_create.bad_roadmap")} <br />
            {t("pages:roadmap_iteration_create.use_dropdown")}
          </p> : null
        }
        <RoadmapIterationForm
          roadmapAlternatives={filteredAlternatives}
          defaultRoadmapId={badRoadmap ? undefined : searchParams.roadmapId as string | undefined}
        />
      </div>
    </>
  );
}
