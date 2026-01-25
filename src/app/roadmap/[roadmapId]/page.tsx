import { notFound } from "next/navigation";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import accessChecker from "@/lib/accessChecker";
import Goals from "@/components/tables/goals";
import Comments from "@/components/comments/comments";
import { AccessLevel } from "@/types";
import ThumbnailGraph from "@/components/graphs/mainGraphs/thumbnailGraph";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { DataSeries, Goal } from "@prisma/client";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { IconCircleFilled, IconEdit } from "@tabler/icons-react";
import Link from "next/link";
import TextEditor from "@/components/form/elements/textEditor/editor";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params
  const [t, session, roadmap] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId)
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/roadmap/${params.roadmapId}`,
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: roadmap?.metaRoadmap.name,
    description: roadmap?.description,
    og_url: `/roadmap/${params.roadmapId}`,
    og_image_url: undefined
  })
}

export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea(["pages", "common"]),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId)
  ]);

  const featuredGoals: Array<Goal & { dataSeries: DataSeries | null }> = roadmap?.goals.filter((goal) => goal.isFeatured) || [];

  let accessLevel: AccessLevel = AccessLevel.None;
  if (roadmap) {
    accessLevel = accessChecker(roadmap, session.user)
  }

  // 404 if the roadmap doesn't exist or if the user doesn't have access to it
  if (!roadmap || !accessLevel) {
    return notFound();
  }
 
  return <>

    <Breadcrumb object={roadmap} />

    <main>
      <section className="flex justify-content-space-between flex-wrap-wrap gap-100 margin-block-300" >
        <div className="flex-grow-100">
          <span style={{ color: 'gray' }}>{t("pages:roadmap.title")}</span>
          <h1 className="margin-0">{roadmap.metaRoadmap.name}</h1>
          <p className="margin-0">
            {t("pages:roadmap.version", { version: roadmap.version })}
            {" • "}
            {roadmap.metaRoadmap.actor ?
              <>
                {roadmap.metaRoadmap.actor}
                {" • "}
              </>
              :
              null
            }
            {t("common:count.goal", { count: roadmap.goals.length })}
            {"  "}
            {/* TODO: style link to better match surroundings */}
            <Link href={`/metaRoadmap/${roadmap.metaRoadmapId}`}>{t("pages:roadmap.show_series")}</Link>
          </p>
          <div className="margin-top-100">
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
        </div>

        {/* Only show the edit link if the user has edit access to the roadmap */}
        {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <Link
            href={`/roadmap/${roadmap.id}/edit`}
            className="flex align-items-center gap-50 font-weight-500 button transparent round color-pureblack text-decoration-none"
            style={{ height: 'fit-content' }}
          >
            {t("common:edit.roadmap_version")}
            <IconEdit style={{ minWidth: '24px' }} aria-hidden="true" />
          </Link>
        }
      </section>

      {featuredGoals.length > 0 ?
        <section className="margin-block-300">
          <h2>{t("pages:roadmap.featured_goals")}</h2>
          <div className="flex flex-wrap-nowrap gap-100 overflow-x-scroll padding-bottom-100" style={{scrollbarWidth: 'thin', scrollbarColor: 'var(--gray) rgba(0,0,0,0)', scrollSnapType: 'x mandatory', direction: 'ltr'}}>
            {featuredGoals.map((goal, key) =>
              goal && (
                <Link key={key} href={`/goal/${goal.id}`} className="color-pureblack text-decoration-none" style={{width: '300px', height: '250px', scrollSnapAlign: 'start'}}>
                  <ThumbnailGraph goal={goal} historicalData={true} />
                </Link>
              )
            )}
          </div>
          {featuredGoals.some(
            goal => goal?.externalDataset && goal?.externalTableId
          ) && (
              <div className="display-flex align-items-center gap-100 margin-top-100 font-weight-500">
                <span style={{ color: 'var(--gray-20)' }}><IconCircleFilled width={12} height={12} fill="#0090ff" aria-hidden="true" className="margin-right-25" />Målbana</span> {/* TODO: i18n, replace with icon*/}
                <span style={{ color: 'var(--gray-20)' }}><IconCircleFilled width={12} height={12} fill="#2e8a56" aria-hidden="true" className="margin-right-25" />Historisk data</span> {/* TODO: i18n, replace with icon */}
              </div>
            )}
        </section>
        : null}

      <section className="margin-block-300">
        <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap.all_goals")}</h2>
        <Goals roadmap={roadmap} accessLevel={accessLevel} />
      </section>
    </main>

    <section className="margin-block-500">
      <Comments comments={roadmap.comments} objectId={roadmap.id} />
    </section>
  </>
}