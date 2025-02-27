import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import Image from "next/image";
import { AccessLevel } from "@/types";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getServerLocale } from "@/functions/serverLocale";
import parentDict from "../goal.dict.json" with { type: "json" };

export default async function Page({
  searchParams
}: {
  searchParams: {
    roadmapId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
  const dict = parentDict.create.page;
  const locale = await getServerLocale();

  const [session, roadmap, roadmapList] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
    getRoadmaps(),
  ]);

  // Ignore the roadmap (and inform user) if it is not found or the user does not have edit access
  const badRoadmap = (
    (!roadmap && typeof searchParams.roadmapId == 'string') ||
    (roadmap && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user))))
  );

  const filteredRoadmaps = roadmapList.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={roadmap || undefined} customSections={[`${dict.breadcrumbCreateGoal[locale]}`]} />
      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.createNewGoal[locale]}
        </h1>
        {badRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {dict.badRoadmap[locale]}
          </p>
        }
        <GoalForm roadmapId={badRoadmap ? undefined : searchParams.roadmapId as string} roadmapAlternatives={filteredRoadmaps} />
      </div>
    </>
  )
}