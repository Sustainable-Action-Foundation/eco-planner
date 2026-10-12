import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RecalculateDataSeriesButton from "@/components/buttons/recalculateDataSeries";
import Comments from "@/components/comments/comments";
import ActionGraph from "@/components/graph/graphs/actionTimeline";
import GoalActionEffectList from "@/components/pages/sections/goalActionEffects";
import { AdminPanel } from "@/components/elements/controls/controls";
import EntityTimestamps from "@/components/generic/timestamps/entityTimestamps";
import VisibilityBadges from "@/components/generic/visibility/visibilityBadges";
import { getGoalByIndicator, getGoalSiblings, getOneGoal, getRoadmapIterations } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import serveTea from "@/lib/i18nServer";
import type { AccessControlled, Goal, MultiRoadmapInstance, RelatedGoal, SiblingGoal, UserAccessContext } from "@/types";
import { AccessLevel } from "@/types/enums";
import { IterationStatus, RoadmapType } from "@/lib/prisma/generated";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/functions/buildMetadata";
import { goalTitleWithLevel } from "@/functions/goalName";
import { IconAlertTriangle, IconArrowNarrowRight, IconBuildings } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import TextEditor from "@/components/form/elements/textEditor/editor";
import type { Metadata } from "next";
import GoalGraphContainer from "@/components/graph/graphs/goal/container";
import UseGoalInRoadmap from "@/components/pages/sections/useGoalInRoadmap";
import ScaledGoalPreview from "@/components/pages/sections/scaledGoalPreview";
import LikeGoalButton from "@/components/buttons/likeGoalButton";
import { getGoalLikeSummary } from "@/fetchers/getGoalLikes";
import Image from "next/image";
import { Suspense } from "react";

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
    title: goal ? goalTitleWithLevel(t, goal, goal.roadmap_iteration.roadmap) : undefined,
    description: goal?.description,
    og_url: `/goal/${params.goalId}`,
    og_image_url: undefined, // TODO: Use graph api here once ready
  });
}

/** The like button with the viewer's like state; per viewer, so it streams in on its own instead of holding up the page */
async function GoalLikes({ goalId }: { goalId: string }) {
  const likes = await getGoalLikeSummary(goalId);
  return <LikeGoalButton goalId={goalId} liked={likes.likedByViewer} likeCount={likes.likeCount} />;
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

  const [t, accessContext, { goal, siblingCandidates }, secondaryGoal, unfilteredIterations] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    // Only the sibling candidates are loaded from the goal's roadmap version: the version and
    // roadmap fields the page shows come with the goal itself
    getOneGoal(params.goalId).then(async goal => ({
      goal,
      siblingCandidates: goal ? await getGoalSiblings(goal.roadmap_iteration_id, goal.indicator_parameter) : [],
    })),
    typeof searchParams.secondaryGoal === "string" ? getOneGoal(searchParams.secondaryGoal) : null,
    getRoadmapIterations(),
  ]) satisfies [ // Did this cause of the nested promises so I wanna have some sanity here:3
    TFunction,
    UserAccessContext | null,
    {
      goal: Goal | null;
      siblingCandidates: SiblingGoal[];
    },
    Goal | null,
    MultiRoadmapInstance[],
  ];

  let accessLevel: AccessLevel = AccessLevel.None;
  if (goal) {
    const goalAccessData: AccessControlled = {
      access_control: goal.roadmap_iteration.roadmap.access_control,
      status: goal.roadmap_iteration.status,
    };
    accessLevel = accessChecker(goalAccessData, accessContext);
  }

  // 404 if the goal doesn't exist or if the user doesn't have access to it
  if (!goal || !accessLevel) {
    return notFound();
  }
  const iteration = goal.roadmap_iteration;

  // Whether a copy of the goal has somewhere to go: a roadmap version the user can edit
  const canCreateGoals = unfilteredIterations.some(iteration =>
    hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, status: iteration.status }, accessContext)));

  // Fetch parent goal
  let parentGoal: RelatedGoal | null = null;
  const parentRoadmapId = iteration.roadmap.parent_roadmap_id;
  if (parentRoadmapId) {
    // The parent roadmap's iteration, picked from the visible iterations already fetched: the
    // targeted version, or the latest published one without a target. Only published versions take
    // part in parent/child relations: drafts are work in progress. (All published versions of a
    // roadmap share its visibility, so the visible list holds the latest published one if any.)
    const publishedParentIterations = unfilteredIterations
      .filter(candidate => candidate.roadmap_id === parentRoadmapId && candidate.status === IterationStatus.PUBLISHED);
    const parentGoalIteration = (iteration.target_version === null || iteration.target_version === 0)
      ? publishedParentIterations.reduce<MultiRoadmapInstance | null>((latest, candidate) => !latest || candidate.version > latest.version ? candidate : latest, null)
      : publishedParentIterations.find(candidate => candidate.version === iteration.target_version) ?? null;

    // If there is a parent iteration, look for a goal with the same indicator parameter in it
    if (parentGoalIteration) {
      parentGoal = await getGoalByIndicator(parentGoalIteration.id, goal.indicator_parameter, goal.data_series?.unit);
    }
  }

  // Get goals with same indicator parameter in roadmap iterations working towards the one containing current goal
  // TODO: If multiple iterations in a series work towards the same target, maybe only count the one with the highest version?
  // Same guard as for the parent: drafts and unlisted versions don't count as children
  const childIterations = unfilteredIterations
    .filter(child => child.roadmap.parent_roadmap_id === iteration.roadmap.id)
    .filter(child => child.target_version === iteration.version || !child.target_version)
    .filter(child => child.status === IterationStatus.PUBLISHED);
  let childGoals: RelatedGoal[] = [];
  if (childIterations.length > 0) {
    const goals = await Promise.all(childIterations.map(async iteration => {
      return getGoalByIndicator(iteration.id, goal.indicator_parameter, goal.data_series?.unit || undefined);
    }));
    childGoals = goals.filter(child => child !== null);
  }

  // If using a recipe, check whether any of its source data series was updated after this data series
  const goalSeries = goal.data_series;
  const shouldUpdate = !!goalSeries?.recipe_used?.source_data_series
    .some(source => source.updated_at > goalSeries.updated_at);

  // Actions in the goal's own roadmap version vs. actions from elsewhere (another
  // version's actions, or versionless actions from the public action database).
  // Actions always belong to versions (never to goals), so "own" means sharing the
  // goal's version: that's the set the version's authors maintain themselves.
  const ownEffects = goal.effects.filter(effect => effect.action.roadmap_iteration_id === goal.roadmap_iteration_id);
  const foreignEffects = goal.effects.filter(effect => effect.action.roadmap_iteration_id !== goal.roadmap_iteration_id);

  return (
    <>
      <Breadcrumb object={goal} />

      {hasEditAccess(accessLevel) &&
        <AdminPanel accessLevel={accessLevel} object={goal} />
      }

      <main>
        <header className="margin-block-300" style={{ fontSize: 'smaller' }}>
          <div className="flex align-items-center gap-50 flex-wrap-wrap">
            <span style={{ color: 'gray' }}>{t("pages:roadmap_iteration.version", { version: iteration.version })}</span>
            <VisibilityBadges status={iteration.status} listing={goal.listing} />
          </div>
          <span className="block margin-0 font-weight-600" style={{ fontSize: '1.15rem' }}>{iteration.roadmap.name}</span> {/* TODO: Check semantics of this  */}
          <div className="margin-block-25 flex justify-content-space-between margin-bottom-50 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray-80)' }}>
            <div className="flex gap-25 align-items-center">
              <IconBuildings strokeWidth={1.75} width={20} height={20} style={{ minWidth: '20px' }} />
              {iteration.roadmap.actor}
            </div>
            <div className="flex gap-50 align-items-center">
              {/* Signed-in readers can like the goal; the likes rank it on their org's landing page */}
              {accessContext ?
                <Suspense fallback={null}>
                  <GoalLikes goalId={goal.id} />
                </Suspense>
                : null}
              <Link href={`/roadmap/${iteration.roadmap_id}`} className="discrete-link flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
                {t("pages:roadmap_iteration.show_series")}
                <IconArrowNarrowRight height={20} width={20} style={{ minWidth: '20px' }} />
              </Link>
            </div>
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
          <small style={{ color: 'gray' }}>{t("pages:goal.title_label")}</small> {/* TODO: Probably use span here instead */}
          {/* Suffixed with the goal's level (national / area name) so copies scaled into local roadmaps aren't mistaken for the national original */}
          <h1 className="margin-0" style={{ fontSize: '3rem', lineHeight: '1' }}>{goalTitleWithLevel(t, goal, iteration.roadmap)}</h1>
          <small style={{ color: 'gray' }} data-testid="goal-indicator-parameter">{goal.indicator_parameter}</small> {/* TODO: Probably use span here instead */}
          <EntityTimestamps createdAt={goal.created_at} updatedAt={goal.updated_at} className="margin-top-25" />
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

        {/* A national goal with local statistics behind it can be taken into the user's own roadmaps; fetches from the statistics APIs, so it streams in */}
        <Suspense fallback={<Image src={'/loaders/3-dots-move.svg'} width={24} height={24} alt='' aria-live="polite" />}>
          <UseGoalInRoadmap goal={goal} roadmapType={iteration.roadmap.type} canCreateGoals={canCreateGoals} />
        </Suspense>

        {/* What a copy of a national goal would be in the user's own area; reads the local statistics, so it streams in too */}
        {accessContext && iteration.roadmap.type === RoadmapType.NATIONAL ?
          <Suspense fallback={null}>
            <ScaledGoalPreview goalId={goal.id} />
          </Suspense>
          : null}

        {/* TODO: Add a way to exclude actions by unchecking them in a list or something. Might need to be moved to a client component together with ActionGraph */}
        <section className="margin-top-300">
          <GoalGraphContainer
            goal={goal}
            parentGoal={parentGoal}
            useHref={canCreateGoals ? `/goal/create?from=${encodeURIComponent(goal.id)}` : null}
            childGoals={childGoals}
            siblingCandidates={siblingCandidates}
            secondaryGoal={secondaryGoal}
          />

        </section>

        {/* The goal's own actions: those living in the same roadmap version as the goal.
            Effects whose action belongs to another version (or to the public action
            database, where actions have no version at all) go in the section below. */}
        <section className="margin-block-300">
          <div
            className='margin-bottom-100 padding-bottom-50 flex justify-content-space-between align-items-center gap-100 flex-wrap-wrap'
            style={{ borderBottom: '1px solid var(--gray)' }}>
            <h2 className='margin-0 font-weight-600' style={{ fontSize: '1.1rem' }}>
              {t("pages:goal.actions_for_goal", { goalName: goal.name ? goal.name : goal.indicator_parameter })}
            </h2>

            {hasEditAccess(accessLevel) &&
              <Link
                href={`/action/create?iterationId=${goal.roadmap_iteration_id}&goalId=${goal.id}`}
                className="button smooth seagreen color-purewhite"
                data-testid="goal-add-action"
                style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                {t("pages:goal.add_action")}
              </Link>
            }
          </div>

          <GoalActionEffectList
            effects={ownEffects}
            accessLevel={accessLevel}
            emptyMessage={t("components:goal_actions.no_actions")}
            testId="goal-action-row"
          />

          {goal.effects.some(effect => effect.action.start_year !== null || effect.action.end_year !== null)
            && <>
              <h3 className="margin-top-500 font-weight-500">
                {t("pages:goal.action_timeline")}
              </h3>
              <ActionGraph actions={goal.effects.map(effect => effect.action)} />
            </>
          }
        </section>

        {/* Effects from actions elsewhere. "Koppla effekt" lives here since linking an
            existing action is what lands an effect in this list (and it can still link
            the goal's own actions too). */}
        <section className="margin-block-300">
          <div
            className='margin-bottom-100 padding-bottom-50 flex justify-content-space-between align-items-center gap-100 flex-wrap-wrap'
            style={{ borderBottom: '1px solid var(--gray)' }}>
            <h2 className='margin-0 font-weight-600' style={{ fontSize: '1.1rem' }}>
              {t("pages:goal.foreign_effects")}
            </h2>

            {hasEditAccess(accessLevel) &&
              <Link
                href={`/effect/create?goalId=${goal.id}`}
                className="button smooth font-weight-500"
                data-testid="goal-link-effect"
                style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                {t("pages:goal.link_effect")}
              </Link>
            }
          </div>

          <GoalActionEffectList
            effects={foreignEffects}
            accessLevel={accessLevel}
            emptyMessage={t("components:goal_actions.no_foreign_effects")}
            testId="goal-foreign-effect-row"
          />
        </section>

      </main>

      <section className="margin-block-500">
        <Comments comments={goal.comments} objectId={goal.id} />
      </section>

    </>
  );
}
