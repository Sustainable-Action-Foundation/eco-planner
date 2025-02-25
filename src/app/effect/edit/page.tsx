import EffectForm from "@/components/forms/effectForm/effectForm.tsx";
import getOneEffect from "@/fetchers/getOneEffect.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import Image from "next/image";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getServerLocale } from "@/functions/serverLocale";
import dict from "./page.dict.json" with { type: "json" };

const editAccess = [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin];

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

  const [session, effect, roadmaps] = await Promise.all([
    getSession(cookies()),
    getOneEffect(typeof searchParams.actionId == 'string' ? searchParams.actionId : '', typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getRoadmaps(),
  ]);

  if (effect == undefined || !editAccess.includes(accessChecker(effect.action.roadmap, session.user)) || !editAccess.includes(accessChecker(effect.goal.roadmap, session.user))) {
    return (
      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.editEffect[locale]}
        </h1>
        <p style={{ color: 'red' }}>
          <Image src="/icons/info.svg" width={24} height={24} alt='' />
          {dict.badEffect[locale]}
        </p>
      </div>
    )
  }

  const roadmapList = roadmaps.filter((roadmap) => editAccess.includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={effect?.action} customSections={[`${dict.breadcrumbEditEffect[locale]}`]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {dict.editEffect[locale]}
        </h1>
        <EffectForm action={effect.action} goal={effect.goal} roadmapAlternatives={roadmapList} currentEffect={effect} />
      </div>
    </>
  )
}