import { getSession } from '@/lib/session';
import RoadmapForm from '@/components/forms/roadmapForm/roadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';

export default async function Page() {
  const [session, metaRoadmapAlternatives] = await Promise.all([
    getSession(cookies()),
    getMetaRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  const filteredAlternatives = metaRoadmapAlternatives.filter(metaRoadmap => {
    if (metaRoadmap.author.id === session.user?.id) {
      return true
    }
    if (metaRoadmap.editors.some(editor => editor.id === session.user?.id)) {
      return true
    }
    if (metaRoadmap.editGroups.some(editGroup => session.user?.userGroups.some(userGroup => userGroup === editGroup.name))) {
      return true
    }
    return false
  })

  return (
    <>
      <Breadcrumb customSections={['Skapa ny färdplansversion']} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          Skapa en ny version av en färdplan
        </h1>
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          metaRoadmapAlternatives={filteredAlternatives}
        />
      </div>
    </>
  )
}