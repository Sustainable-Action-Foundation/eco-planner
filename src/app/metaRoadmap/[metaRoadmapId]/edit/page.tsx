import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getOneMetaRoadmap from '@/fetchers/getOneMetaRoadmap';
import accessChecker from '@/lib/accessChecker';
import { AccessLevel } from '@/types';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';

export async function generateMetadata(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params
  const [t, metaRoadmap] = await Promise.all([
    serveTea("metadata"),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  return buildMetadata({
    title: `${t("metadata:roadmap_series_edit.title")} ${metaRoadmap?.name}`,
    description: metaRoadmap?.description,
    og_url: `/roadmap/${params.metaRoadmapId}/edit`,
    og_image_url: undefined
  })
}


export default async function Page(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params;
  const [t, session, currentRoadmap, parentRoadmapOptions] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
    getMetaRoadmaps(),
  ]);

  const access = accessChecker(currentRoadmap, session.user)

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !currentRoadmap || access == AccessLevel.None || access == AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={currentRoadmap} customSections={[t("pages:roadmap_series_one_edit.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1>{t("pages:roadmap_series_one_edit.title", { name: currentRoadmap.name })}</h1>
        <MetaRoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          parentRoadmapOptions={parentRoadmapOptions}
          currentRoadmap={currentRoadmap}
        />
      </div>
    </>
  )
}