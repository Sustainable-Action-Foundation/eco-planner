import EffectForm from "@/components/form/forms/effect";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";
import { getOneEffect, getRoadmapIterations } from "@/fetchers";
import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    searchParams: Promise<{
      actionId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  },
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const [t, session] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
  ]);

  const params = new URLSearchParams();

  if (Array.isArray(searchParams.actionId)) {
    for (const action of searchParams.actionId) {
      params.append('actionId', action);
    }
  } else if (typeof searchParams.actionId === 'string') {
    params.set('actionId', searchParams.actionId);
  }

  if (Array.isArray(searchParams.goalId)) {
    for (const goal of searchParams.goalId) {
      params.append('goalId', goal);
    }
  } else if (typeof searchParams.goalId === 'string') {
    params.set('goalId', searchParams.goalId);
  }

  const ownUrl = `/effect/edit?${params.toString()}`;

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: ownUrl,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: t("metadata:effect_edit.title"),
    description: undefined,
    og_url: ownUrl,
    og_image_url: undefined,
  });
}


export default async function Page(
  props: {
    searchParams: Promise<{
      actionId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  },
) {
  const searchParams = await props.searchParams;
  const [t, accessContext, effect, iterations] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneEffect(typeof searchParams.actionId == 'string' ? searchParams.actionId : '', typeof searchParams.goalId == 'string' ? searchParams.goalId : ''),
    getRoadmapIterations(),
  ]);

  // Roadmapless actions (the public action database) are editable by the owning org's managers
  const mayEditAction = effect ? (
    effect.action.roadmap_iteration
      ? hasEditAccess(accessChecker({ access_control: effect.action.roadmap_iteration.roadmap.access_control, published_at: effect.action.roadmap_iteration.published_at }, accessContext))
      : (accessContext?.isSuperAdmin || accessContext?.memberships.some(membership => membership.orgId === effect.action.org_id && membership.role === OrgRole.MANAGER)) ?? false
  ) : false;

  if (
    !effect
    || !mayEditAction
    || !hasEditAccess(accessChecker({ access_control: effect.goal.roadmap_iteration.roadmap.access_control, published_at: effect.goal.roadmap_iteration.published_at }, accessContext))
  ) {
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
    );
  }

  /** TODO: redundant? the getRoadmapIterations function already does checks? */
  const roadmapList = iterations.filter((iteration) => hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext)));

  return (
    <>
      <Breadcrumb object={effect.action} customSections={[t("pages:effect_edit.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_edit.title")}
        </h1>
        <EffectForm
          currentEffect={effect}
          roadmaps={roadmapList}
        />
      </div>
    </>
  );
}