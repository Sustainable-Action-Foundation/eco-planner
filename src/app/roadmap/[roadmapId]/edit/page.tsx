import { BgetDictionary } from '@/app/dictionaries';
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapForm from "@/components/forms/roadmapForm/roadmapForm";
import { DEFAULT_LOCALE } from '@/constants';
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from '@/lib/session';
import { AccessLevel, Locale } from '@/types';
import { cookies, headers } from 'next/headers';
import Link from "next/link";
import { notFound } from 'next/navigation';


export default async function Page({ params }: { params: { roadmapId: string } }) {
  const locale = headers().get("locale") as Locale || DEFAULT_LOCALE as Locale;

  const [session, roadmap, dict] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(params.roadmapId),
    BgetDictionary("@/app/roadmap/[roadmapId]/page"),
  ]);

  const access = accessChecker(roadmap, session.user)

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !roadmap || access == AccessLevel.None || access == AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={roadmap} customSections={[`${'edit' in dict && dict.edit.editRoadmapVersion[locale]}`]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {'edit' in dict && dict.edit.editRoadmapVersion[locale]}
        </h1>
        <p className="margin-block-300">{'edit' in dict && dict.edit.didYouMeanTo[locale]}<Link href={`/metaRoadmap/${roadmap.metaRoadmapId}/edit`}>{'edit' in dict && dict.edit.goHere[locale]}</Link>{'edit' in dict && dict.edit.toEdit[locale]}</p>
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          currentRoadmap={roadmap}
        />
      </div>
    </>
  )
}