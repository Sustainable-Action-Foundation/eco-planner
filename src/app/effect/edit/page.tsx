import EffectForm from "@/components/forms/effectForm/effectForm.tsx";
import getOneEffect from "@/fetchers/getOneEffect.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker.ts";
import { getSession } from "@/lib/session.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";

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

  const ownUrl = new URL('/effect/edit');
  if (Array.isArray(searchParams.actionId)) {
    for (const action of searchParams.actionId) {
      ownUrl.searchParams.append('actionId', action);
    }
  } else if (typeof searchParams.actionId === 'string') {
    ownUrl.searchParams.set('actionId', searchParams.actionId);
  }
  if (Array.isArray(searchParams.goalId)) {
    for (const goal of searchParams.goalId) {
      ownUrl.searchParams.append('goalId', goal);
    }
  } else if (typeof searchParams.goalId === 'string') {
    ownUrl.searchParams.set('goalId', searchParams.goalId);
  }

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `${ownUrl.pathname}${ownUrl.search}`,
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: t("metadata:effect_edit.title"),
    description: undefined,
    og_url: `${ownUrl.pathname}${ownUrl.search}`,
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

  if (effect == undefined || !hasEditAccess(accessChecker(effect.action.roadmap, session.user)) || !hasEditAccess(accessChecker(effect.goal.roadmap, session.user))) {
    return (
      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_edit.title")}
        </h1>
        <p style={{ color: 'red' }}>
          <IconInfoCircle role="img" aria-label={t("pages:effect_edit.information_icon_aria")} />
          {t("pages:effect_edit.no_access")}
        </p>
      </div>
    )
  }

  const roadmapList = roadmaps.filter((roadmap) => hasEditAccess(accessChecker(roadmap, session.user)));

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