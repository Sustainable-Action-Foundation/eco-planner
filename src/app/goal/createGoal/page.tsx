import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import Image from "next/image";
import { AccessLevel } from "@/types";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";


export default async function Page({
  searchParams
}: {
  searchParams: {
    roadmapId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
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
      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Skapa ny målbana</h1>
        {badRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Kunde inte hitta eller har inte tillgång till färdplanen i länken. <br />
            Använd dropdown-menyn för att välja en färdplan att skapa målbanan under.
          </p>
        }
        <GoalForm roadmapId={badRoadmap ? undefined : searchParams.roadmapId as string} roadmapAlternatives={filteredRoadmaps} />
      </div>
    </>
  )
}