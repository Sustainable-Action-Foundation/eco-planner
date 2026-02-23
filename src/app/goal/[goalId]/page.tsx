import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RecalculateDataSeriesButton from "@/components/buttons/recalculateDataSeries";
import Comments from "@/components/comments/comments";
import QueryBuilder from "@/components/form/api/queryBuilder";
import ActionGraph from "@/components/graph/graphs/actionTimeline";
import ChildGraphContainer from "@/components/graph/graphs/goal/child/container";
import GraphGraph from "@/components/graph/graphs/goal/main/container";
import SiblingGraph from "@/components/graph/graphs/goal/sibling/siblings";
import CopyAndScale from "@/components/modals/copyAndScale";
import EffectTable from "@/components/tables/effects.tsx";
import { AdminPanel } from "@/components/elements/controls/controls";
import getGoalByIndicator from "@/fetchers/getGoalByIndicator";
import getOneGoal from "@/fetchers/getOneGoal";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import getRoadmapByVersion from "@/fetchers/getRoadmapByVersion";
import getRoadmaps from "@/fetchers/getRoadmaps";
import findSiblings from "@/functions/findSiblings.ts";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { ApiTableContent } from "@/lib/api/apiTypes";
import { getSession } from "@/lib/session";
import serveTea from "@/lib/i18nServer";
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel, Goal, MultiRoadmapInstance, Roadmap } from "@/types";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import getTableContent from "@/lib/api/getTableContent";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconAlertTriangle, IconArrowBackUp, IconArrowNarrowRight, IconBuildings } from "@tabler/icons-react";
import i18nServer, { TFunction } from "i18next";
import TextEditor from "@/components/form/elements/textEditor/editor";

export async function generateMetadata(props: {
  params: Promise<{ goalId: string }>,
  searchParams: Promise<{
    secondaryGoal?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }>,
}) {
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
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: goal?.name,
    description: goal?.description,
    og_url: `/goal/${params.goalId}`,
    og_image_url: undefined, // TODO: Use graph api here once ready 
  })
}

export default async function Page(
  props: {
    params: Promise<{ goalId: string }>,
    searchParams: Promise<{
      secondaryGoal?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  }
) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams
  ]);

  const [t, session, { goal, roadmap }, secondaryGoal, unfilteredRoadmapOptions] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneGoal(params.goalId).then(async goal => ({
      goal,
      roadmap: goal ? await getOneRoadmap(goal.roadmapId) : null
    })),
    typeof searchParams.secondaryGoal === "string" ? getOneGoal(searchParams.secondaryGoal) : null,
    getRoadmaps(),
  ]) satisfies [ // Did this cause of the nested promises so I wanna have some sanity here:3
    TFunction,
    Awaited<ReturnType<typeof getSession>>,
    {
      goal: Goal | null;
      roadmap: Roadmap | null;
    },
    Goal | null,
    MultiRoadmapInstance[],
  ];

  const locale = i18nServer.language.split("-")[0]; // TODO - Illegal!! plz use a more proper method 🥺

  let accessLevel: AccessLevel = AccessLevel.None;
  if (goal) {
    const goalAccessData: AccessControlled = {
      author: goal.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic
    }
    accessLevel = accessChecker(goalAccessData, session.user);
  }

  // 404 if the goal doesn't exist or if the user doesn't have access to it
  if (!goal || !accessLevel || !roadmap) {
    return notFound();
  }

  // Create a list of roadmaps the user can copy and scale the goal to
  const roadmapOptions = unfilteredRoadmapOptions.filter(roadmap => {
    if (session.user?.isAdmin) return true;
    if (roadmap.authorId === session.user?.id) return true;
    if (roadmap.editors.some(editor => editor.id === session.user?.id)) return true;
    if (roadmap.editGroups.some(editGroup => session.user?.userGroups.some(userGroup => userGroup === editGroup.name))) return true;
    return false;
  }).map(roadmap => ({ id: roadmap.id, name: roadmap.metaRoadmap.name, version: roadmap.version, actor: roadmap.metaRoadmap.actor }))

  // TODO: remove when moving external to data series + recipe
  // Fetch external data
  let externalData: ApiTableContent | null = null;
  if (goal.externalDataset && goal.externalTableId && goal.externalSelection) {
    externalData = await getTableContent(goal.externalTableId, goal.externalDataset, goal.externalSelection, locale);
  }

  // Fetch parent goal
  let parentGoal: Goal | null = null;
  let parentGoalRoadmap: Roadmap | null = null;
  if (roadmap?.metaRoadmap.parentRoadmapId) {
    try {
      // Get the parent roadmap (if any)
      parentGoalRoadmap = await getRoadmapByVersion(roadmap.metaRoadmap.parentRoadmapId,
        roadmap.targetVersion ||
        (await prisma.roadmap.aggregate({ where: { metaRoadmapId: roadmap.metaRoadmap.parentRoadmapId }, _max: { version: true } }))._max.version ||
        0);

      // If there is a parent roadmap, look for a goal with the same indicator parameter in it
      if (parentGoalRoadmap) {
        parentGoal = await getGoalByIndicator(parentGoalRoadmap.id, goal.indicatorParameter, goal.dataSeries?.unit);
      }
    } catch (error) {
      parentGoal = null;
      console.log(error);
    }
  }

  // Get goals with same indicator parameter in roadmaps working towards the one containing current goal
  // TODO: If multiple roadmaps in a series work towards the same target, maybe only count the one with the highest version?
  const childRoadmaps = unfilteredRoadmapOptions.filter(child => child.metaRoadmap.parentRoadmapId === roadmap.metaRoadmap.id).filter(child => child.targetVersion === roadmap.version || !child.targetVersion);
  let childGoals: (NonNullable<Awaited<ReturnType<typeof getGoalByIndicator>>> & { roadmapName?: string })[] = [];
  if (childRoadmaps.length > 0) {
    const goals = await Promise.all(childRoadmaps.map(async roadmap => {
      return getGoalByIndicator(roadmap.id, goal.indicatorParameter, goal.dataSeries?.unit || undefined);
    }));
    childGoals = goals.filter(child => child !== null);
    for (const child of childGoals) {
      child.roadmapName = childRoadmaps.find(roadmap => roadmap.id === child.roadmapId)?.metaRoadmap.name;
    }
  }

  let shouldUpdate = false;
  // If using a recipe, check all source data series if their updatedAt is newer than this data series last updated
  if (goal.dataSeries && goal.dataSeries.recipeUsedId) {
    const sourceDataSeries = await prisma.recipe.findMany({
      where: {
        id: goal.dataSeries.recipeUsedId,
      },
      select: {
        sourceDataSeries: { select: { id: true, updatedAt: true, }, },
      },
    });
    for (const source of sourceDataSeries) {
      for (const dataSeries of source.sourceDataSeries) {
        if (dataSeries.updatedAt > goal.dataSeries.updatedAt) {
          shouldUpdate = true;
        }
      }
    }
  }

  return (
    <>
      <Breadcrumb object={goal} />

      {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
        <AdminPanel accessLevel={accessLevel} object={goal} />
      }

      <main>
        <header className="margin-block-300" style={{ fontSize: 'smaller' }}>
          <span style={{ color: 'gray' }}>{t("pages:roadmap.version", { version: roadmap.version })}</span>
          <span className="block margin-0 font-weight-600" style={{ fontSize: '1.15rem' }}>{roadmap.metaRoadmap.name}</span> {/* TODO: Check semantics of this  */}
          <div className="margin-block-25 flex justify-content-space-between margin-bottom-50 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray-80)' }}>
            <div className="flex gap-25 align-items-center">
              <IconBuildings strokeWidth={1.75} width={20} height={20} style={{ minWidth: '20px' }} />
              {roadmap.metaRoadmap.actor}
            </div>
            <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}`} className="discrete-link flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              {t("pages:roadmap.show_series")}
              <IconArrowNarrowRight height={20} width={20} style={{ minWidth: '20px' }} />
            </Link>
          </div>
        </header>

        {/* TODO: Incorrect semantics, sections missing a header (not sure if the aria-label is proper). Make this something else? */}
        {shouldUpdate && goal.dataSeries && // Redundant additional check to satisfy type engine
          <section
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
              dataSeriesId={goal.dataSeries.id}
            />
          </section>
        }

        <header>
          {goal.name ? (
            <>
              <small style={{ color: 'gray' }}>{t("pages:goal.title_label")}</small> {/* TODO: Probably use span here instead */}
              <h1 className="margin-0" style={{ fontSize: '3rem', lineHeight: '1' }}>{goal.name}</h1>
              <small style={{ color: 'gray' }}>{goal.indicatorParameter}</small> {/* TODO: Probably use span here instead */}
            </>
          ) :
            <>
              <small style={{ color: 'gray' }}>{t("pages:goal.title_label")}</small> {/* TODO: Probably use span here instead */}
              <h1 className="margin-0" style={{ lineHeight: '1' }}>{goal.indicatorParameter}</h1>
            </>
          }
        </header>

        {goal.description ?
          <>
            <TextEditor
              className="margin-top-50"
              id="rich-description"
              editable={false}
              defaultStyles={false}
              content={goal.description}
            />
          </>
          : null}

        <section className='margin-top-300'> {/* TODO: Potentially break this out of a section when removing h2 (if we remove h2) (Actions may still be a section but the ) */}
          <h2 className="padding-bottom-50 margin-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:goal.title_label")}</h2>
          <section>
            {/* TODO: Add a way to exclude actions by unchecking them in a list or something. Might need to be moved to a client component together with ActionGraph */}
            <GraphGraph
              goal={goal}
              parentGoal={parentGoal}
              childGoals={childGoals}
              roadmap={roadmap}
              parentGoalRoadmap={parentGoalRoadmap}
              historicalData={externalData}
              secondaryGoal={secondaryGoal}
              effects={goal.effects}
            >
              <div className="flex gap-25 margin-left-100">
                <QueryBuilder goal={goal} />
                {(goal.dataSeries?.id && session.user) ?
                  <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
                  : null}
              </div>
            </GraphGraph>
          </section>

          <section className="margin-block-300">
            <div
              className='margin-bottom-100 padding-bottom-50 flex justify-content-space-between align-items-center gap-100 flex-wrap-wrap'
              style={{ borderBottom: '1px solid var(--gray)' }}>
              <h3 className='margin-0 font-weight-600' style={{ fontSize: '1.1rem' }}>
                {t("pages:goal.actions_for_goal", { goalName: goal.name ? goal.name : goal.indicatorParameter })}
              </h3>

              {hasEditAccess(accessLevel) &&
                <menu className="margin-0 padding-0 flex justify-content-flex-end gap-25">
                  <Link
                    href={`/effect/create?goalId=${goal.id}`}
                    className="button smooth font-weight-500"
                    style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                    {t("pages:goal.link_existing_action")}
                  </Link>
                  <Link
                    href={`/action/create?roadmapId=${goal.roadmapId}&goalId=${goal.id}`}
                    className="button smooth seagreen color-purewhite"
                    style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                    {t("pages:goal.create_new_action")}
                  </Link>
                </menu>
              }
            </div>

            {/* TODO: rename to EffectsList? */}
            <EffectTable object={goal} accessLevel={accessLevel} />

            {goal.effects.some(effect => effect.action.startYear || effect.action.endYear) &&
              <>
                <h4 className="margin-top-500 font-weight-500">
                  {t("pages:goal.action_timeline")}
                </h4>
                <article className="smooth purewhite margin-bottom-500" style={{ border: '1px solid var(--gray-90)' }}>
                  <ActionGraph actions={goal.effects.map(effect => effect.action)} />
                </article>
              </>
            }
          </section>
        </section>

        {childGoals.length > 0 ?
          <section className="margin-block-300">
            <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>
              {t("pages:goal.goals_working_towards", { goalName: goal.name ? goal.name : goal.indicatorParameter })}
            </h2>
            <ChildGraphContainer goal={goal} childGoals={childGoals} />
          </section>
          : null
        }

        {findSiblings(roadmap, goal).length > 1 ?
          <section className="margin-block-300">
            <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>
              {t("pages:goal.related_goals")}
            </h2>
            <SiblingGraph roadmap={roadmap} goal={goal} />
          </section>
          : null
        }

      </main>

      <section className="margin-block-500">
        <Comments comments={goal.comments} objectId={goal.id} />
      </section>

    </>
  )
}