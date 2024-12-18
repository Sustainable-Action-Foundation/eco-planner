import getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoadmapTable from "@/components/tables/roadmapTable";
import { TableMenu } from "@/components/tables/tableMenu/tableMenu";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

export default async function Page({ params }: { params: { metaRoadmapId: string } }) {
  const [session, metaRoadmap] = await Promise.all([
    getSession(cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  const accessLevel = accessChecker(metaRoadmap, session.user);

  // 404 if the meta roadmap doesn't exist or the user doesn't have access
  if (!metaRoadmap) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={metaRoadmap} customSections={['Färdplan']} />

      <section className="margin-block-100 padding-block-100" style={{ borderBottom: '2px solid var(--gray-90)' }}>
        <div className="flex gap-100 flex-wrap-wrap justify-content-space-between margin-block-100" style={{ fontSize: '1rem' }}>
          <div>
            <h1 className="margin-0">{metaRoadmap.name}</h1>
            <small>Metadata för en färdplan</small>
          </div>
          {/* Only show the edit link if the user has edit access to the roadmap */}
          {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
            <TableMenu
              accessLevel={accessLevel}
              object={metaRoadmap}
            />
            : null}
        </div>
        {/* Only show link for creating a new version if the user has edit access to the roadmap */}
        {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
          <div className="flex justify-content-flex-end "><a href={`/roadmap/createRoadmap?metaRoadmapId=${metaRoadmap.id}`} className="button pureblack color-purewhite round">Skapa ny färdplan</a></div>
          : null}
      </section>

      <section>
        <RoadmapTable user={session.user} metaRoadmap={metaRoadmap} />
      </section>
    </>
  )
}