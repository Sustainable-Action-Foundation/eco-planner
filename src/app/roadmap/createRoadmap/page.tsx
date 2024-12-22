import { getSession } from '@/lib/session';
import RoadmapForm from '@/components/forms/roadmapForm/roadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import Image from "next/image";
import { AccessLevel } from '@/types';
import accessChecker from '@/lib/accessChecker';
import getOneMetaRoadmap from '@/fetchers/getOneMetaRoadmap';

export default async function Page({
  searchParams
}: {
  searchParams: {
    metaRoadmapId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
  const [session, parent, metaRoadmapAlternatives] = await Promise.all([
    getSession(cookies()),
    getOneMetaRoadmap(typeof searchParams.metaRoadmapId == 'string' ? searchParams.metaRoadmapId : ''),
    getMetaRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  const badMetaRoadmap = (
    searchParams.metaRoadmapId instanceof Array ||
    (!parent && typeof searchParams.metaRoadmapId == 'string') ||
    (parent && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(parent, session.user))))
  );

  // The meta roadmaps the user can create the new roadmap under (the ones they have edit access to)
  const filteredAlternatives = metaRoadmapAlternatives.filter(metaRoadmap =>
    [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(metaRoadmap, session.user))
  );

  return (
    <>
      <Breadcrumb object={parent || undefined} customSections={['Skapa ny färdplansversion']} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          Skapa en ny version av en färdplan
        </h1>
        {badMetaRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Kunde inte hitta eller har inte tillgång till färdplansserien i länken. <br />
            Använd dropdown-menyn för att välja en färdplansserie.
          </p>
        }
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          metaRoadmapAlternatives={filteredAlternatives}
          defaultMetaRoadmap={badMetaRoadmap ? undefined : searchParams.metaRoadmapId as string | undefined}
        />
      </div>
    </>
  )
}