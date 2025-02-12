import RoadmapForm from "@/components/forms/roadmapForm/roadmapForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import accessChecker from "@/lib/accessChecker";
import { AccessLevel } from "@/types";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

export default async function Page({ params }: { params: { roadmapId: string } }) {
  const [session, roadmap] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  const access = accessChecker(roadmap, session.user)

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !roadmap || access == AccessLevel.None || access == AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={roadmap} customSections={['Redigera färdplansversion']} />
      
      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          Redigera färdplansversion
        </h1>
        <p className="margin-block-300">Menade du att redigera den gemensamma metadatan för hela färdplansserien? I så fall kan du <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}/edit`}>gå hit</Link> för att redigera metadatan.</p>
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          currentRoadmap={roadmap}
        />
      </div>
    </>
  )
}