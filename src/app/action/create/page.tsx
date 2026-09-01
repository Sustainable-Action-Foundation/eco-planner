import ActionForm from "@/components/form/forms/action";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import type { AccessControlled } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconInfoCircle } from "@tabler/icons-react";
import { getOneGoal, getOneRoadmapIteration, getRoadmapIterations } from "@/fetchers";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:action_create.title"),
    description: t("metadata:action_create.description"),
    og_url: `/action/create`,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: {
    searchParams: Promise<{
      iterationId?: string | string[] | undefined,
      goalId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  },
) {
  const searchParams = await props.searchParams;
  const [t, accessContext, goal, iteration, iterationList] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneGoal(typeof searchParams.goalId === 'string' ? searchParams.goalId : ''),
    getOneRoadmapIteration(typeof searchParams.iterationId === 'string' ? searchParams.iterationId : ''),
    getRoadmapIterations(),
  ]);

  if (
    Array.isArray(searchParams.goalId)
    || Array.isArray(searchParams.iterationId)
  ) {
    throw new Error("Invalid parameters"); // TODO: Should this be a throw?
  }

  let goalAccessData: AccessControlled | null = null;
  if (goal) {
    goalAccessData = {
      access_control: goal.roadmap_iteration.roadmap.access_control,
      status: goal.roadmap_iteration.status,
    };
  }

  // Ignore the goal or iteration (and inform user) if they are not found or the user does not have edit access
  const badGoal = (
    (!goal && typeof searchParams.goalId === 'string')
    || (goal && !hasEditAccess(accessChecker(goalAccessData, accessContext)))
  );
  const badRoadmap = (
    (!iteration && typeof searchParams.iterationId === 'string')
    || (iteration && !hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, status: iteration.status }, accessContext)))
  );

  // The roadmap iterations the user can choose to add the action to (the ones they have edit access to)
  const availableIterations = iterationList.filter((iteration) =>
    hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, status: iteration.status }, accessContext)),
  );

  return (
    <>
      <Breadcrumb object={goal ?? iteration ?? undefined} customSections={[t("pages:action_create.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        {goal
          ? <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
            {t("pages:action_create.title_with_goal", { goalName: goal?.name || goal?.indicator_parameter })}
          </h1>
          : <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
            {t("pages:action_create.title")}
          </h1>
        }
        {badGoal ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" aria-label={t("pages:action_create.information_icon_aria")} />
            {t("pages:action_create.bad_goal")}
          </p> : null
        }
        {badRoadmap ? <p style={{ color: 'red' }}>
            <IconInfoCircle role="img" ria-label={t("pages:action_create.information_icon_aria")} />
            {t("pages:action_create.bad_roadmap")}
          </p> : null
        }
        <ActionForm
          goalId={badGoal ? undefined : searchParams.goalId}
          iterationId={badRoadmap ? undefined : searchParams.iterationId}
          roadmaps={availableIterations}
        />
      </div>
    </>
  );
}
