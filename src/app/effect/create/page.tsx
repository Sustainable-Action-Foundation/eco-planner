import EffectForm from "@/components/forms/forms/effect"
import getOneAction from "@/fetchers/getOneAction.ts";
import getOneGoal from "@/fetchers/getOneGoal.ts";
import getRoadmaps from "@/fetchers/getRoadmaps.ts";
import accessChecker from "@/lib/accessChecker.ts";
import { getSession } from "@/lib/session.ts";
import { AccessLevel } from "@/types.ts";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";

export async function generateMetadata() {
  const t = await serveTea("metadata")

  return buildMetadata({
    title: t("metadata:effect_create.title"),
    description: t("metadata:effect_create.description"),
    og_url: `/effect/create`,
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
  const [t, session, action, goal, roadmaps] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
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
      <Breadcrumb object={action || goal || undefined} customSections={[t("pages:effect_create.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:effect_create.title")}
        </h1>
        {badAction &&
          <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:effect_create.information_icon_aria")} />
            {t("pages:effect_create.bad_action")}
          </p>
        }
        {badGoal &&
          <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:effect_create.information_icon_aria")} />
            {t("pages:effect_create.bad_goal")}
          </p>
        }
        <EffectForm action={badAction ? null : action} goal={badGoal ? null : goal} roadmapAlternatives={roadmapList} />
      </div>
    </>
  )
}