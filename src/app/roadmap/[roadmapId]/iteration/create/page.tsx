import { getSession } from '@/lib/session';
import RoadmapIterationForm from '@/components/form/forms/roadmapIteration';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import accessChecker, { hasEditAccess } from '@/lib/accessChecker';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';
import { getOneRoadmap, getRoadmaps, getUserAccessContext } from "@/fetchers";
import { HiddenRoadmaps } from "@/types/enums";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:roadmap_iteration_create.title"),
    description: t('metadata:roadmap_iteration_create.description'),
    og_url: `/roadmap/${params.roadmapId}/iteration/create`,
    og_image_url: undefined,
  });
}

export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, accessContext, parent, roadmapAlternatives] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getUserAccessContext(),
    getOneRoadmap(params.roadmapId),
    // Include: the form also looks up each roadmap's parent for the target version (filtered below)
    getRoadmaps(HiddenRoadmaps.Include),
  ]);

  // User must be signed in and have edit access to the roadmap in the path, which must exist
  if (!session.user || !parent || !hasEditAccess(accessChecker(parent, accessContext))) {
    return notFound();
  }

  // The roadmaps the user can create the new iteration under (the ones they have edit access to)
  // (hidden ones stay out, except the roadmap in the path)
  const filteredAlternatives = roadmapAlternatives.filter(roadmap =>
    hasEditAccess(accessChecker(roadmap, accessContext)) && (!roadmap.hidden || roadmap.id === params.roadmapId),
  );

  return (
    <>
      <Breadcrumb object={parent} customSections={[t("pages:roadmap_iteration_create.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_iteration_create.title")}
        </h1>
        <RoadmapIterationForm
          roadmapAlternatives={filteredAlternatives}
          defaultRoadmapId={params.roadmapId}
        />
      </div>
    </>
  );
}
