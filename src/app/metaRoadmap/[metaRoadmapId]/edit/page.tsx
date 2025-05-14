import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getOneMetaRoadmap from '@/fetchers/getOneMetaRoadmap';
import accessChecker from '@/lib/accessChecker';
import { AccessLevel } from '@/types';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import { t } from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';

export async function generateMetadata({ params }: { params: { metaRoadmapId: string } }) {

  const [metaRoadmap] = await Promise.all([
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  return buildMetadata({ 
    title: `Redigera färdplansserie: ${metaRoadmap?.name}`, // TODO: UUID To long if no name here?
    description: metaRoadmap?.description,  /* TODO: Seperate description? */
    og_url: `roadmap/${metaRoadmap?.id}/edit` // TODO: metaroadmap?.id fine?
  })  
}


export default async function Page(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params;
  const [session, currentRoadmap, parentRoadmapOptions] = await Promise.all([
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