import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapForm from "@/components/forms/roadmapForm/roadmapForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/functions/serverLocale";
import { createDict } from "../../roadmap.dict.ts";

export default async function Page({ params }: { params: { roadmapId: string } }) {
  const locale = await getServerLocale();
  const dict = createDict(locale)["[roadmapId]"].edit.page;

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
      <Breadcrumb object={roadmap} customSections={[`${dict.breadcrumbEditRoadmapVersion}`]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.editRoadmapVersion}
        </h1>
        <p className='margin-block-300'>
          {dict.didYouMeanTo}
          <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}/edit`}>
            {dict.goHere}
          </Link>
          {dict.toEdit}
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
