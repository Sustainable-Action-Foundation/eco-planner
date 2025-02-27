import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getOneMetaRoadmap from '@/fetchers/getOneMetaRoadmap';
import accessChecker from '@/lib/accessChecker';
import { AccessLevel } from '@/types';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import { getServerLocale } from "@/functions/serverLocale";
import parentDict from "../../metaRoadmap.dict.json" with { type: "json" };

export default async function Page({ params }: { params: { metaRoadmapId: string } }) {
  const dict = parentDict["[metaRoadmapId]"].edit.page;
  const locale = await getServerLocale();
  
  const [session, currentRoadmap, parentRoadmapOptions] = await Promise.all([
    getSession(cookies()),
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
      <Breadcrumb object={currentRoadmap} customSections={[`${dict.breadcrumbEditMetadata[locale]}`]} />

      <div className='container-text margin-inline-auto'>
        <h1>{dict.editMetadata[locale]} {`${currentRoadmap.name}`}</h1>
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