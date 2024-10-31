import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import GoalForm from "@/components/forms/goalForm/goalForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import accessChecker from "@/lib/accessChecker";
import { AccessLevel } from "@/types";


export default async function Page({
  searchParams
}: {
  searchParams: {
    roadmapId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
  const [session, roadmap] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
  ]);

  // Ignore the roadmap (and inform user) if it is not found or the user does not have edit access
  const badRoadmap = (
    (!roadmap && typeof searchParams.roadmapId == 'string') ||
    (roadmap && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user))))
  );

  return (
    <>
      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Skapa ny målbana</h1>
        {
          (badRoadmap || !searchParams.roadmapId) ?
            <p>
              {`Målbanor kan bara skapas under färdplaner. Testa att navigera till en färdplan du har redigeringsbehörighet till och klicka på knappen "Skapa ny målbana"`}
            </p>
            :
            <GoalForm roadmapId={searchParams.roadmapId as string} />
        }
      </div>
    </>
  )
}