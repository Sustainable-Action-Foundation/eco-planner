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
import Image from "next/image";
import { DataSeries, Goal } from "@prisma/client";
import { t } from "@/lib/i18nServer";

export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [session, roadmap] = await Promise.all([
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
            <a href={`/metaRoadmap/${roadmap.metaRoadmapId}`}>{t("pages:roadmap.show_series")}</a>
          </p>
          <p className="margin-bottom-0">{roadmap.metaRoadmap.description}</p>
          {roadmap.description ? (
            <p className="margin-bottom-0">{roadmap.description}</p>
          ) : null}
          {/* TODO: Add external resources here and to the form
            <h2 className="margin-bottom-0 margin-top-200" style={{fontSize: '1.25rem'}}>Externa resurser</h2>
            <ul>
              {roadmap.metaRoadmap.links.map((link: { url: string, description: string | null }, index: number) => 
                <li className="margin-block-25" key={index}>
                  <a href={link.url} target="_blank">{link.description}</a>
                </li>
              )}
            </ul>
          */}
        </div>

        {/* Only show the edit link if the user has edit access to the roadmap */}
        {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <a
            href={`/roadmap/${roadmap.id}/edit`}
            className="flex align-items-center gap-50 font-weight-500 button transparent round color-pureblack text-decoration-none"
            style={{ height: 'fit-content' }}
          >
            {t("common:edit.roadmap_version")}
            <Image src="/icons/edit.svg" alt="" width="24" height="24" />
          </a>
        }
      </section>

      {featuredGoals.length > 0 ?
        <section className="margin-block-300">
          <h2>{t("pages:roadmap.featured_goals")}</h2>
          <div className="grid gap-100" style={{ gridTemplateColumns: 'repeat(auto-fit, 300px)' }}>
            {featuredGoals.map((goal, key) =>
              goal && (
                <a key={key} href={`/goal/${goal.id}`} className="color-pureblack text-decoration-none">
                  <ThumbnailGraph goal={goal} />
                </a>
              )
            )}
          </div>
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