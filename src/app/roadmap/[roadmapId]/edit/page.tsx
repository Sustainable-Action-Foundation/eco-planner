import { getSession } from '@/lib/session';
import RoadmapForm from '@/components/form/forms/roadmap';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import accessChecker, { hasEditAccess } from '@/lib/accessChecker';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';
import { getOneRoadmap, getRoadmaps, getUserAccessContext } from "@/fetchers";
import { getOrgOptions } from '@/fetchers/getOrgOptions';
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/roadmap/${params.roadmapId}/edit`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: `${t("metadata:roadmap_edit.title")} ${roadmap?.name}`,
    description: roadmap?.description,
    og_url: `/roadmap/${params.roadmapId}/edit`,
    og_image_url: undefined,
  });
}


export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, accessContext, currentRoadmap, parentRoadmapOptions, orgOptions] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getUserAccessContext(),
    getOneRoadmap(params.roadmapId),
    getRoadmaps(),
    getOrgOptions(),
  ]);

  const access = accessChecker(currentRoadmap, accessContext);

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !currentRoadmap || !hasEditAccess(access)) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={currentRoadmap} customSections={[t("pages:roadmap_edit.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_edit.title", { name: currentRoadmap.name })}
        </h1>
        <RoadmapForm
          isSuperAdmin={session.user.isSuperAdmin}
          orgOptions={orgOptions}
          parentRoadmapOptions={parentRoadmapOptions.filter(roadmap => roadmap.id !== currentRoadmap.id)}
          currentRoadmap={currentRoadmap}
        />
      </div>
    </>
  );
}
