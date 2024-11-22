import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/forms/actionForm/actionForm";
import Image from "next/image";
import accessChecker from "@/lib/accessChecker";
import getOneGoal from "@/fetchers/getOneGoal";
import { AccessControlled, AccessLevel } from "@/types";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

export default async function Page({
  searchParams
}: {
  searchParams: {
    roadmapId?: string | string[] | undefined,
    goalId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }
}) {
  const [session, goal, roadmap, roadmapList] = await Promise.all([
    getSession(cookies()),
    getOneGoal(typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getOneRoadmap(typeof searchParams.roadmapId == 'string' ? searchParams.roadmapId : ''),
    getRoadmaps(),
  ]);

  let goalAccessData: AccessControlled | null = null;
  if (goal) {
    goalAccessData = {
      author: goal.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic
    }
  }

  // Ignore the goal or roadmap (and inform user) if they are not found or the user does not have edit access
  const badGoal = (
    (!goal && typeof searchParams.goalId == 'string') ||
    (goal && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(goalAccessData, session.user))))
  );
  const badRoadmap = (
    (!roadmap && typeof searchParams.roadmapId == 'string') ||
    (roadmap && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user))))
  );

  // The roadmaps the user can choose to add the action to (the ones they have edit access to)
  const availableRoadmaps = roadmapList.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={goal || roadmap || undefined} customSections={['Skapa ny åtgärd']} />

      <div className="container-text" style={{ marginInline: 'auto' }}>
        {goal ?
          <h1>Skapa ny åtgärd under målbana: {`${goal?.name || goal?.indicatorParameter}`}</h1>
          :
          <h1>Skapa ny åtgärd</h1>
        }
        {badGoal &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Kunde inte hitta eller har inte tillgång till målbanan i länken.
            {/* Använd dropdown-menyn för att välja en målbana om du vill lägga till en effekt gentemot en målbana. */}
          </p>
        }
        {badRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Kunde inte hitta eller har inte tillgång till färdplanen i länken. <br />
            Använd dropdown-menyn för att välja en färdplan.
          </p>
        }
        <ActionForm
          goalId={badGoal ? undefined : searchParams.goalId as string | undefined}
          roadmapId={badRoadmap ? undefined : searchParams.roadmapId as string | undefined}
          roadmapAlternatives={availableRoadmaps}
        />
      </div>
    </>
  )
}