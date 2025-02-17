import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapForm from "@/components/forms/roadmapForm/roadmapForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale, validateDict } from "@/functions/serverLocale";
import dict from "./page.dict.json";

export default async function Page({ params }: { params: { roadmapId: string } }) {
  validateDict(dict);
  const locale = getServerLocale();

  const [session, roadmap] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  const access = accessChecker(roadmap, session.user);

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !roadmap || access == AccessLevel.None || access == AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={roadmap} customSections={[`${dict.edit.editRoadmapVersion[locale]}`]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.edit.editRoadmapVersion[locale]}
        </h1>
        <p className='margin-block-300'>
          {dict.edit.didYouMeanTo[locale]}
          <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}/edit`}>
            {dict.edit.goHere[locale]}
          </Link>
          {dict.edit.toEdit[locale]}
        </p>
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          currentRoadmap={roadmap}
        />
      </div>
    </>
  );
}
