import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RecalculateDataSeriesButton from "@/components/buttons/recalculateDataSeries";
import Comments from "@/components/comments/comments";
import ActionGraph from "@/components/graph/graphs/actionTimeline";
import EffectTable from "@/components/tables/effects";
import { AdminPanel } from "@/components/elements/controls/controls";
import { getGoalByIndicator, getOneGoal, getOneRoadmapIteration, getRoadmapIterationByVersion, getRoadmapIterations } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import type { AccessControlled, Goal, MultiRoadmapInstance, RoadmapIteration, UserAccessContext } from "@/types";
import { AccessLevel } from "@/types/enums";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconAlertTriangle, IconArrowNarrowRight, IconBuildings } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import TextEditor from "@/components/form/elements/textEditor/editor";
import type { Metadata } from "next";
import GoalGraphContainer from "@/components/graph/graphs/goal/container";

export async function generateMetadata(props: {
  params: Promise<{ goalId: string }>,
  searchParams: Promise<{
    secondaryGoal?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }>,
}): Promise<Metadata> {
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
      og_url: `/goal/${params.goalId}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: goal?.name,
    description: goal?.description,
    og_url: `/goal/${params.goalId}`,
    og_image_url: undefined, // TODO: Use graph api here once ready
  });
}

export default async function Page(
  props: {
    params: Promise<{ goalId: string }>,
    searchParams: Promise<{
      secondaryGoal?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  },
) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const [t, session, accessContext, { goal, iteration }, secondaryGoal, unfilteredIterations] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getUserAccessContext(),
    getOneGoal(params.goalId).then(async goal => ({
      goal,
      iteration: goal ? await getOneRoadmapIteration(goal.roadmap_iteration_id) : null,
    })),
    typeof searchParams.secondaryGoal === "string" ? getOneGoal(searchParams.secondaryGoal) : null,
    getRoadmapIterations(),
  ]) satisfies [ // Did this cause of the nested promises so I wanna have some sanity here:3
    TFunction,
    Awaited<ReturnType<typeof getSession>>,
    UserAccessContext | null,
    {
      goal: Goal | null;
      iteration: RoadmapIteration | null;
    },
    Goal | null,
    MultiRoadmapInstance[],
  ];

  let accessLevel: AccessLevel = AccessLevel.None;
  if (goal) {
    const goalAccessData: AccessControlled = {
      access_control: goal.roadmap_iteration.roadmap.access_control,
      published_at: goal.roadmap_iteration.published_at,
    };
    accessLevel = accessChecker(goalAccessData, accessContext);
  }

  // 404 if the goal doesn't exist or if the user doesn't have access to it
  if (!goal || !accessLevel || !iteration) {
    return notFound();
  }

  // Create a list of roadmap iterations the user can copy and scale the goal to
  const roadmapOptions = unfilteredIterations.filter(iteration => {
    return hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext));
  }).map(iteration => ({ id: iteration.id, name: iteration.roadmap.name, version: iteration.version, actor: iteration.roadmap.actor }));

  // Fetch parent goal
  let parentGoal: Goal | null = null;
  let parentGoalIteration: RoadmapIteration | null;
  if (iteration.roadmap.parent_roadmap_id) {
    try {
      // Get the parent roadmap iteration (if any)
      parentGoalIteration = await getRoadmapIterationByVersion(
        iteration.roadmap.parent_roadmap_id,
        (iteration.target_version === null || iteration.target_version === 0)
          ? (await prisma.roadmapIterations.aggregate({ where: { roadmap_id: iteration.roadmap.parent_roadmap_id }, _max: { version: true } }))._max.version ?? 0
          : iteration.target_version,
      );

      // If there is a parent iteration, look for a goal with the same indicator parameter in it
      if (parentGoalIteration) {
        parentGoal = await getGoalByIndicator(parentGoalIteration.id, goal.indicator_parameter, goal.data_series?.unit);
      }
    }
    catch (err) {
      parentGoal = null;
      console.error(err);
    }
  }

  // Get goals with same indicator parameter in roadmap iterations working towards the one containing current goal
  // TODO: If multiple iterations in a series work towards the same target, maybe only count the one with the highest version?
  const childIterations = unfilteredIterations.filter(child => child.roadmap.parent_roadmap_id === iteration.roadmap.id).filter(child => child.target_version === iteration.version || !child.target_version);
  let childGoals: (NonNullable<Awaited<ReturnType<typeof getGoalByIndicator>>> & { roadmapName?: string })[] = [];
  if (childIterations.length > 0) {
    const goals = await Promise.all(childIterations.map(async iteration => {
      return getGoalByIndicator(iteration.id, goal.indicator_parameter, goal.data_series?.unit || undefined);
    }));
    childGoals = goals.filter(child => child !== null);
    for (const child of childGoals) {
      child.roadmapName = childIterations.find(iteration => iteration.id === child.roadmap_iteration_id)?.roadmap.name;
    }
  }

  let shouldUpdate = false;
  // If using a recipe, check all source data series if their updated_at is newer than this data series last updated
  if (goal.data_series?.recipe_used_id) {
    const sourceDataSeries = await prisma.recipes.findMany({
      where: {
        id: goal.data_series.recipe_used_id,
      },
      select: {
        source_data_series: { select: { id: true, updated_at: true } },
      },
    });
    for (const source of sourceDataSeries) {
      for (const dataSeries of source.source_data_series) {
        if (dataSeries.updated_at > goal.data_series.updated_at) {
          shouldUpdate = true;
        }
      }
    }
  }

  return (
    <>
      <Breadcrumb object={goal} />

      {hasEditAccess(accessLevel) &&
        <AdminPanel accessLevel={accessLevel} object={goal} />
      }

      <main>
        <header className="margin-block-300" style={{ fontSize: 'smaller' }}>
          <span style={{ color: 'gray' }}>{t("pages:roadmap.version", { version: iteration.version })}</span>
          <span className="block margin-0 font-weight-600" style={{ fontSize: '1.15rem' }}>{iteration.roadmap.name}</span> {/* TODO: Check semantics of this  */}
          <div className="margin-block-25 flex justify-content-space-between margin-bottom-50 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray-80)' }}>
            <div className="flex gap-25 align-items-center">
              <IconBuildings strokeWidth={1.75} width={20} height={20} style={{ minWidth: '20px' }} />
              {iteration.roadmap.actor}
            </div>
            <Link href={`/roadmap/${iteration.roadmap_id}`} className="discrete-link flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              {t("pages:roadmap.show_series")}
              <IconArrowNarrowRight height={20} width={20} style={{ minWidth: '20px' }} />
            </Link>
          </div>
        </header>

        {/* TODO: Incorrect semantics, sections missing a header (not sure if the aria-label is proper). Make this something else? */}
        {shouldUpdate && goal.data_series ? <section
          aria-label={t("pages:goal.update_needed_attention_message")}
          className="flex justify-content-space-between align-items-center margin-block-300 padding-25 rounded"
          style={{ border: '1px solid gold', backgroundColor: 'rgba(255, 255, 0, .35)' }}
        >
          <div className="flex align-items-center gap-100 margin-left-100">
            <IconAlertTriangle style={{ minWidth: '24px' }} aria-hidden="true" />
            <strong className="font-weight-500">{t("pages:goal.update_needed")}</strong>
          </div>
          <RecalculateDataSeriesButton
            label={t("components:update_goal_button.update")}
            dataSeriesId={goal.data_series.id}
          />
        </section> : null
        }

        <header>
          {goal.name ? (
            <>
              <small style={{ color: 'gray' }}>{t("pages:goal.title_label")}</small> {/* TODO: Probably use span here instead */}
              <h1 className="margin-0" style={{ fontSize: '3rem', lineHeight: '1' }}>{goal.name}</h1>
              <small style={{ color: 'gray' }}>{goal.indicator_parameter}</small> {/* TODO: Probably use span here instead */}
            </>
          ) :
            <>
              <small style={{ color: 'gray' }}>{t("pages:goal.title_label")}</small> {/* TODO: Probably use span here instead */}
              <h1 className="margin-0" style={{ lineHeight: '1' }}>{goal.indicator_parameter}</h1>
            </>
          }
        </header>

        {goal.description ?
          <TextEditor
            className="margin-top-50"
            id="rich-description"
            editable={false}
            defaultStyles={false}
            content={goal.description}
          />
          : null}

        {/* TODO: Add a way to exclude actions by unchecking them in a list or something. Might need to be moved to a client component together with ActionGraph */}
        <section className="margin-top-300">
          <GoalGraphContainer
            goal={goal}
            parentGoal={parentGoal}
            childGoals={childGoals}
            iteration={iteration}
            secondaryGoal={secondaryGoal}
            session={{ user: session.user }}
            roadmapOptions={roadmapOptions}
          />

        </section>

        <section className="margin-block-300">
          <div
            className='margin-bottom-100 padding-bottom-50 flex justify-content-space-between align-items-center gap-100 flex-wrap-wrap'
            style={{ borderBottom: '1px solid var(--gray)' }}>
            <h2 className='margin-0 font-weight-600' style={{ fontSize: '1.1rem' }}>
              {t("pages:goal.actions_for_goal", { goalName: goal.name ? goal.name : goal.indicator_parameter })}
            </h2>

            {hasEditAccess(accessLevel) &&
              <menu className="margin-0 padding-0 flex justify-content-flex-end gap-25">
                <Link
                  href={`/effect/create?goalId=${goal.id}`}
                  className="button smooth font-weight-500"
                  style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                  {t("pages:goal.link_existing_action")}
                </Link>
                <Link
                  href={`/action/create?iterationId=${goal.roadmap_iteration_id}&goalId=${goal.id}`}
                  className="button smooth seagreen color-purewhite"
                  style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                  {t("pages:goal.create_new_action")}
                </Link>
              </menu>
            }
          </div>

          {/* TODO: rename to EffectsList? */}
          <EffectTable object={goal} accessLevel={accessLevel} />

          {goal.effects.some(effect => effect.action.start_year !== null || effect.action.end_year !== null)
            && <>
              <h3 className="margin-top-500 font-weight-500">
                {t("pages:goal.action_timeline")}
              </h3>
              <ActionGraph actions={goal.effects.map(effect => effect.action)} />
            </>
          }
        </section>

      </main>

      <section className="margin-block-500">
        <Comments comments={goal.comments} objectId={goal.id} />
      </section>

    </>
  );
}
