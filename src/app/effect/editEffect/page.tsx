import EffectForm from "@/components/forms/effectForm/effectForm.tsx";
import getOneEffect from "@/fetchers/getOneEffect.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import Image from "next/image";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

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

  if (!editAccess.includes(accessChecker(effect?.action.roadmap, session.user)) || !editAccess.includes(accessChecker(effect?.goal.roadmap, session.user))) {
    return (
      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Skapa ny effekt</h1>
        <p style={{ color: 'red' }}>
          <Image src="/icons/info.svg" width={24} height={24} alt='' />
          Effekten du försöker redigera finns inte eller så har du inte redigeringsbehörighet till den.
        </p>
      </div>
    )
  }

  const roadmapList = roadmaps.filter((roadmap) => editAccess.includes(accessChecker(roadmap, session.user)));

  return (
    <>
      <Breadcrumb object={effect?.action} customSections={['Redigera effekt']} />

      <div className="container-text" style={{ marginInline: 'auto' }}>
        <h1>Redigera effekt</h1>
        <EffectForm action={effect!.action} goal={effect!.goal} roadmapAlternatives={roadmapList} currentEffect={effect!} />
      </div>
    </>
  )
}