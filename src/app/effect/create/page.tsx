import EffectForm from "@/components/forms/effectForm/effectForm.tsx"
import getOneAction from "@/fetchers/getOneAction.ts";
import getOneGoal from "@/fetchers/getOneGoal.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import Image from "next/image";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getServerLocale } from "@/functions/serverLocale";
import { createDict } from "../effect.dict.ts";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    actionId?: string | string[] | undefined,
    goalId?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  },
}) {
  const locale = await getServerLocale();
  const dict = createDict(locale).create.page;

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
      <Breadcrumb object={action || goal || undefined} customSections={[`${dict.breadcrumbCreateEffect}`]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.createNewEffect}
        </h1>
        {badAction &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {dict.badAction}
          </p>
        }
        {badGoal &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {dict.badGoal}
          </p>
        }
        <EffectForm action={badAction ? null : action} goal={badGoal ? null : goal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}