import EffectForm from "@/components/forms/effectForm/effectForm.tsx";
import getOneEffect from "@/fetchers/getOneEffect.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import Image from "next/image";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { t } from "@/lib/i18nServer";

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
  const [session, effect, roadmaps] = await Promise.all([
    getSession(cookies()),
    getOneEffect(typeof searchParams.actionId == 'string' ? searchParams.actionId : '', typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getRoadmaps(),
  ]);

  if (effect == undefined || !editAccess.includes(accessChecker(effect.action.roadmap, session.user)) || !editAccess.includes(accessChecker(effect.goal.roadmap, session.user))) {
    return (
      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_edit.title")}
        </h1>
        <p style={{ color: 'red' }}>
          <Image src="/icons/info.svg" width={24} height={24} alt='' />
          {t("pages:effect_edit.no_access")}
        </p>
      </div>
    )
  }

  const roadmapList = roadmaps.filter((roadmap) => editAccess.includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={effect?.action} customSections={[t("pages:effect_edit.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_edit.title")}
        </h1>
        <EffectForm action={effect.action} goal={effect.goal} roadmapAlternatives={roadmapList} currentEffect={effect} />
      </div>
    </>
  )
}