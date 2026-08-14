import EffectForm from "@/components/form/forms/effect";
import { getOneAction, getOneGoal, getRoadmapIterations } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { OrgRole } from "@/lib/prisma/generated";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:effect_create.title"),
    description: t("metadata:effect_create.description"),
    og_url: `/effect/create`,
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
  const [t, accessContext, action, goal, iterations] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneAction(typeof searchParams.actionId === 'string' ? searchParams.actionId : ''),
    getOneGoal(typeof searchParams.goalId === 'string' ? searchParams.goalId : ''),
    getRoadmapIterations(),
  ]);

  // Roadmapless actions (the public action database) are editable by the owning org's managers
  const mayEditAction = action ? (
    action.roadmap_iteration
      ? hasEditAccess(accessChecker({ access_control: action.roadmap_iteration.roadmap.access_control, published_at: action.roadmap_iteration.published_at }, accessContext))
      : (accessContext?.isSuperAdmin || accessContext?.memberships.some(membership => membership.orgId === action.org_id && membership.role === OrgRole.MANAGER)) ?? false
  ) : false;

  const badAction = (
    (!action && typeof searchParams.actionId === 'string')
    || (action && !mayEditAction)
  );

  const badGoal = (
    (!goal && typeof searchParams.goalId === 'string')
    || (goal && !hasEditAccess(accessChecker({ access_control: goal.roadmap_iteration.roadmap.access_control, published_at: goal.roadmap_iteration.published_at }, accessContext)))
  );

  const roadmapList = iterations.filter((iteration) => hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext)));

  return (
    <>
      <Breadcrumb object={action ?? goal ?? undefined} customSections={[t("pages:effect_create.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_create.title")}
        </h1>
        {badAction ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:effect_create.information_icon_aria")} />
            {t("pages:effect_create.bad_action")}
          </p> : null
        }
        {badGoal ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:effect_create.information_icon_aria")} />
            {t("pages:effect_create.bad_goal")}
          </p> : null
        }
        <EffectForm
          action={action}
          goal={goal}
          roadmaps={roadmapList}
        />
      </div>
    </>
  );
}
