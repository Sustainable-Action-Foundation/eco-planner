import { notFound } from "next/navigation";
import { getOneRoadmap } from "@/fetchers";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import accessChecker from "@/lib/accessChecker";
import Goals from "@/components/tables/goals";
import Comments from "@/components/comments/comments";
import { AccessLevel } from "@/types/enums";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconArrowNarrowRight, IconBuildings, IconCircleFilled } from "@tabler/icons-react";
import Link from "next/link";
import TextEditor from "@/components/form/elements/textEditor/editor";
import { AdminPanel } from "@/components/elements/controls/controls";
import ActionTable from "@/components/tables/actions";
import GoalGraph from "@/components/graph/graphs/goal/main";
import graphStyles from "@/components/graph/graphs/goal/goal.module.css";
import { getHistoricalDataset } from "@/functions/getHistoricalDataset";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/roadmap/${params.roadmapId}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: roadmap?.metaRoadmap.name,
    description: roadmap?.description,
    og_url: `/roadmap/${params.roadmapId}`,
    og_image_url: undefined,
  });
}

export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea(["pages", "common"]),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  const featuredGoals = (roadmap?.goals ?? [])
    .filter((goal) => goal.isFeatured)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      indicatorParameter: goal.indicatorParameter,
      dataSeries: goal.dataSeries,
      historical: goal.historical,
    }));

  let accessLevel: AccessLevel = AccessLevel.None;
  if (roadmap) {
    accessLevel = accessChecker(roadmap, session.user);
  }

  // 404 if the roadmap doesn't exist or if the user doesn't have access to it
  if (!roadmap || !accessLevel) {
    return notFound();
  }

  return <>

    <Breadcrumb object={roadmap} />

    {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
      <AdminPanel accessLevel={accessLevel} object={roadmap} />
    }

    <main>
      <header className="margin-block-300" >
        <span style={{ color: 'gray' }}>{t("pages:roadmap.version", { version: roadmap.version })}</span>
        <h1 className="margin-0">{roadmap.metaRoadmap.name}</h1>
        <div className="margin-block-25 flex justify-content-space-between margin-bottom-50 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray-80)' }}>
          {roadmap.metaRoadmap.actor ?
            <div className="flex gap-25 align-items-center">
              <IconBuildings strokeWidth={1.75} style={{ minWidth: '24px' }} />
              {roadmap.metaRoadmap.actor}
            </div>
            :
            null
          }
          <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}`} className="discrete-link flex gap-25 align-items-center" style={{ lineHeight: '1' }} data-testid="show-roadmap-series">
            {t("pages:roadmap.show_series")}
            <IconArrowNarrowRight height={20} width={20} style={{ minWidth: '20px' }} />
          </Link>
        </div>
        <span className="font-weight-600">
          {t("common:count.goal", { count: roadmap.goals.length })}
        </span>
      </header>

      <div className="margin-top-300">
        <TextEditor
          id="rich-description"
          editable={false}
          defaultStyles={false}
          content={roadmap.metaRoadmap.description}
        />
      </div>
      {roadmap.description ? (
        <div className="margin-top-100">
          <TextEditor
            id="rich-description"
            editable={false}
            defaultStyles={false}
            content={roadmap.description}
          />
        </div>
      ) : null}

      {featuredGoals.length > 0 ?
        <section className="margin-block-300">
          <h2>{t("pages:roadmap.featured_goals")}</h2>
          <div className="flex flex-wrap-nowrap gap-100 overflow-x-scroll padding-bottom-100" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--gray) rgba(0,0,0,0)', scrollSnapType: 'x mandatory', direction: 'ltr' }}>
            {featuredGoals.map((goal, key) => {
              if (!goal) return null;
              const historicalDataset = goal.historical && getHistoricalDataset(goal);
              
              return (
                <Link key={key} href={`/goal/${goal.id}`} className="color-pureblack text-decoration-none" style={{ width: '300px', minWidth: '300px', height: '250px', scrollSnapAlign: 'start' }} data-testid="featured-goals">
                  <div className={`${graphStyles['thumbnail-graph']}`}>
                    <h3 className="font-weight-500 margin-0 padding-top-75 padding-inline-75 overflow-hidden white-space-nowrap text-align-center text-overflow-ellipsis">
                      {!!goal.name ? goal.name : goal.indicatorParameter}
                    </h3>
                    <div className="flex-grow-100">
                      <GoalGraph
                        chartType="thumbnail"
                        series={{
                          main: goal?.dataSeries && {
                            name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
                            unit: goal.dataSeries.unit,
                            dateValues: Object.fromEntries(
                              goal.dataSeries.values.map((value) => [
                                value.timestamp.toISOString(),
                                value.value,
                              ]),
                            ),
                          },
                          historical: goal?.historical && {
                            name: historicalDataset?.label
                              ? `${historicalDataset.label} (${t("common:historical_data")})`
                              : t("common:historical_data"),
                            unit: goal.historical.unit,
                            dateValues: Object.fromEntries(
                              goal.historical.values.map((value) => [
                                value.timestamp.toISOString(),
                                value.value,
                              ]),
                            ),
                          },
                        }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {featuredGoals.some(
            goal => goal?.historical,
          ) && (
              <div className="display-flex align-items-center gap-100 margin-top-100 font-weight-500">
                <span style={{ color: 'var(--gray-20)' }}><IconCircleFilled width={12} height={12} fill="#0090ff" aria-hidden="true" className="margin-right-25" />{t("common:goal_one")}</span>
                <span style={{ color: 'var(--gray-20)' }}><IconCircleFilled width={12} height={12} fill="#2e8a56" aria-hidden="true" className="margin-right-25" />{t("common:historical_data")}</span>
              </div>
            )}
        </section>
        : null}

      <section className="margin-block-300">
        <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap.all_goals")}</h2>
        <Goals roadmap={roadmap} accessLevel={accessLevel} />
      </section>

      <section className="margin-block-300">
        <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap.all_actions")}</h2>
        <ActionTable actions={roadmap.actions} accessLevel={accessLevel} roadmapId={roadmap.id} />
      </section>
    </main>

    <section className="margin-block-500">
      <Comments comments={roadmap.comments} objectId={roadmap.id} />
    </section>
  </>;
}