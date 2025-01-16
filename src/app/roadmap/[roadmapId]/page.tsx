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

export default async function Page({ params }: { params: { roadmapId: string } }) {
  const [session, roadmap] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(params.roadmapId)
  ]);

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

    <div className="display-flex justify-content-space-between flex-wrap-wrap margin-top-200" style={{ borderBottom: '2px dashed var(--gray-90)' }}>
      <div className="flex-grow-100 margin-block-100">
        <span style={{ color: 'gray' }}>Färdplan</span>
        <h1 className="margin-0">{roadmap.metaRoadmap.name}</h1>
        <p className="margin-0">
          <>Version {roadmap.version} • </>
          {(roadmap.metaRoadmap.actor) &&
            <>{roadmap.metaRoadmap.actor} • </>
          }
          <>{roadmap.goals.length} målbanor • </>
          {/* TODO: style link to better match surroundings */}
          <a href={`/metaRoadmap/${roadmap.metaRoadmapId}`}>Besök färdplansserien</a>
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
      { // Only show the edit link if the user has edit access to the roadmap
        (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
        <aside className="display-flex justify-content-flex-end margin-bottom-100">
          <a href={`/roadmap/${roadmap.id}/edit`} className="display-flex align-items-center gap-50 font-weight-500" style={{ textDecoration: 'none', color: 'black', height: 'fit-content' }}>
            Redigera färdplansversionen
            <Image src="/icons/edit.svg" alt="" width="24" height="24" />
          </a>
        </aside>
      }
    </div>

    <div
      className="grid gap-100 margin-bottom-100 padding-block-100 align-items-flex-end"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, 300px)'
      }}
    >
      {roadmap.goals.map((goal, key) =>
        goal.isFeatured ?
          <div key={key}>
            <a href={`/goal/${goal.id}`}>
              <ThumbnailGraph goal={goal} />
            </a>
            {goal.name ? (
              <h3 className="text-align-center">{goal.name}</h3>
            ) : null}
          </div>
          : null
      )}
    </div>

    <Goals title="Målbanor" roadmap={roadmap} accessLevel={accessLevel} />
    <Comments comments={roadmap.comments} objectId={roadmap.id} />
  </>
}