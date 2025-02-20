import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import { getServerLocale, validateDict } from "@/functions/serverLocale";
import dict from "./page.dict.json" assert { type: "json" };

export default async function Page() {
  await validateDict(dict);
  const locale = await getServerLocale();

  const [session, parentRoadmapOptions] = await Promise.all([
    getSession(cookies()),
    getMetaRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbCreateRoadmap[locale]}`]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.newRoadmap[locale]}
        </h1>
        <MetaRoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          parentRoadmapOptions={parentRoadmapOptions}
        />
      </div>
    </>
  )
}