import getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoadmapTable from "@/components/tables/roadmapTables/roadmapTable";
import { TableMenu } from "@/components/tables/tableMenu/tableMenu";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params

  const [metaRoadmap] = await Promise.all([
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  return buildMetadata({
    title: metaRoadmap?.name,
    description: metaRoadmap?.description,
    og_url: `/metaRoadmap/${metaRoadmap?.id}`,
    og_image_url: undefined
  })
}


export default async function Page(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params;
  const [t, session, metaRoadmap] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  const accessLevel = accessChecker(metaRoadmap, session.user);

  // 404 if the meta roadmap doesn't exist or the user doesn't have access
  if (!metaRoadmap) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={metaRoadmap} />

      <main>
        <section className="margin-block-300">
          <div className="flex gap-100 flex-wrap-wrap justify-content-space-between" style={{ fontSize: '1rem' }}>
            <div>
              <span style={{ color: 'gray' }}>{t("pages:roadmap_series_one.title_legend")}</span>
              <h1 className="margin-0">{metaRoadmap.name}</h1>
              <small>{t("pages:roadmap_series_one.description_legend")}</small>
              <p>{metaRoadmap.description}</p>
              {metaRoadmap.links.length > 0 ?
                <>
                  <h2 className="margin-bottom-0 margin-top-200">{t("pages:common.external_resources")}</h2>
                  <ul>
                    {metaRoadmap.links.map((link: { url: string, description: string | null }, index: number) =>
                      <li className="margin-block-25" key={index}>
                        <a href={link.url} target="_blank">{link.description}</a>
                      </li>
                    )}
                  </ul>
                </>
                : null
              }
            </div>

            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <TableMenu
                accessLevel={accessLevel}
                object={metaRoadmap}
              />
              : null}
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap_series_one.roadmap_versions")}</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <a href={`/roadmap/create?metaRoadmapId=${metaRoadmap.id}`} className="button pureblack color-purewhite round">{t("pages:roadmap_series_one.create_roadmap_version")}</a>
              : null}
          </menu>
          <RoadmapTable user={session.user} metaRoadmap={metaRoadmap} />
        </section>
      </main>
    </>
  )
}