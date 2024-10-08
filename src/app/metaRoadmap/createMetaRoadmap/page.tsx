import { getSession } from '@/lib/session';
import MetaRoadmapForm from '@/components/forms/metaRoadmapForm/metaRoadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import Image from 'next/image';

export default async function Page() {
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
      <div className='container margin-inline-auto flex gap-100 justify-content-space-around'>
        <section className='container-text'>
          <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{borderBottom: '1px solid var(--gray-90)'}}>Skapa en ny färdplan</h1>
          <MetaRoadmapForm
            user={session.user}
            userGroups={session.user?.userGroups}
            parentRoadmapOptions={parentRoadmapOptions}
          />
        </section>
      </div>
    </>
  )
}