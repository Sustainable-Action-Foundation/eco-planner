import EffectForm from "@/components/forms/effectForm/effectForm.tsx";
import getOneEffect from "@/fetchers/getOneEffect.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";

const editAccess = [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin];

export async function generateMetadata(
  props: {
    searchParams: Promise<{
      actionId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  }
) {
  const searchParams = await props.searchParams;
  const [t, session] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/effect/edit?actionId=${searchParams.actionId}&goalId=${searchParams.goalId}`,
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: t("metadata:effect_edit.title"),
    description: undefined,
    og_url: `/effect/edit?actionId=${searchParams.actionId}&goalId=${searchParams.goalId}`,
    og_image_url: undefined
  })
}


export default async function Page(
  props: {
    searchParams: Promise<{
      actionId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  }
) {
  const searchParams = await props.searchParams;
  const [t, session, effect, roadmaps] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
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
          <IconInfoCircle />
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