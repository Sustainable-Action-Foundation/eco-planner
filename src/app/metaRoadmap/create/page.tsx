import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';

export async function generateMetadata() {
  return buildMetadata({
    title: 'Skapa ny färdplansserie',
    description: undefined,  /* TODO: Seperate description? */
    og_url: '/metaRoadmap/create'
  })
}

export default async function Page() {
  const [t, session, parentRoadmapOptions] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getMetaRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb customSections={[t("pages:roadmap_series_one_create.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_series_one_create.title")}
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