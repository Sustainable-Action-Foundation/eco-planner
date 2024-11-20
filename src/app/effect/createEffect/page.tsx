import EffectForm from "@/components/forms/effectForm/effectForm.tsx"
import getOneAction from "@/fetchers/getOneAction.ts";
import getOneGoal from "@/fetchers/getOneGoal.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import Image from "next/image";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    actionId?: string | string[] | undefined,
    goalId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  },
}) {
  const [session, action, goal, roadmaps] = await Promise.all([
    getSession(cookies()),
    getOneAction(typeof searchParams.actionId == 'string' ? searchParams.actionId : ''),
    getOneGoal(typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getRoadmaps(),
  ]);

  const badAction = (
    (!action && typeof searchParams.actionId == 'string') ||
    (action && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(action.roadmap, session.user))))
  );

  const badGoal = (
    (!goal && typeof searchParams.goalId == 'string') ||
    (goal && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(goal.roadmap, session.user))))
  );

  const roadmapList = roadmaps.filter((roadmap) => [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Skapa ny effekt</h1>
        {badAction &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Åtgärden du angav i URL:en kunde inte hittas eller så har du inte redigeringsbehörighet till den. Vänligen välj en ny i formuläret nedan.
          </p>
        }
        {badGoal &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            Målbanan du angav i URL:en kunde inte hittas eller så har du inte redigeringsbehörighet till den. Vänligen välj en ny i formuläret nedan.
          </p>
        }
        <EffectForm action={badAction ? null : action} goal={badGoal ? null : goal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}