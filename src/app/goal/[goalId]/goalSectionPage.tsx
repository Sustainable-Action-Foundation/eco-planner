import "server-only";

import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getOneGoal } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { buildMetadata } from "@/functions/buildMetadata";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { getSession } from "@/lib/session";
import type { Goal } from "@/types";
import type { TFunction } from "i18next";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/*
 * Shared by the goal's focused edit pages (data series, baseline, historical
 * data): the access gate, the metadata and the page chrome around the form.
 */

/** The goal, provided it exists and the current user may edit it; otherwise a 404. */
export async function getEditableGoal(goalId: string): Promise<Goal> {
  const [accessContext, goal] = await Promise.all([
    getUserAccessContext(),
    getOneGoal(goalId),
  ]);

  if (!goal || !accessContext || !hasEditAccess(accessChecker({
    access_control: goal.roadmap_iteration.roadmap.access_control,
    published_at: goal.roadmap_iteration.published_at,
  }, accessContext))) {
    return notFound();
  }

  return goal;
}

/** Metadata for a goal sub-page at `/goal/[goalId]/<path>`; `title` gets the goal when the user is logged in. */
export async function goalSectionMetadata(
  props: { params: Promise<{ goalId: string }> },
  path: string,
  title: (t: TFunction, goal: Goal | null) => string,
): Promise<Metadata> {
  const params = await props.params;
  const [t, session, goal] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneGoal(params.goalId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/goal/${params.goalId}/${path}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: title(t, goal),
    description: goal?.description,
    og_url: `/goal/${params.goalId}/${path}`,
    og_image_url: undefined, // TODO METADATA: Use graph api here once ready
  });
}

/** Breadcrumb, heading and text-width container around a goal section form. */
export function GoalSectionPage({
  goal,
  breadcrumb,
  title,
  children,
}: {
  goal: Goal;
  breadcrumb: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <Breadcrumb object={goal} customSections={[breadcrumb]} />

      <main className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {title}
        </h1>
        {children}
      </main>
    </>
  );
}
