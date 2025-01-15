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
          {(roadmap.metaRoadmap.actor) &&
            <> {roadmap.metaRoadmap.actor} • </>
          }
          {roadmap.goals.length} målbanor
        </p>
        <p className="margin-bottom-0">{roadmap.metaRoadmap.description}</p>
      </div>
      { // Only show the edit link if the user has edit access to the roadmap
        (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
        <aside className="display-flex justify-content-flex-end margin-bottom-100">
          <a href={`/roadmap/${roadmap.id}/editRoadmap`} className="display-flex align-items-center gap-50 font-weight-500" style={{ textDecoration: 'none', color: 'black', height: 'fit-content' }}>
            Redigera färdplansversionen
            <Image src="/icons/edit.svg" alt="" width="24" height="24" />
          </a>
        </aside>
      }
    </div>


    {roadmap.description ? (
      <p>{roadmap.description}</p>
    ) : null}

    <div
      className="grid gap-100 margin-bottom-100 padding-block-100 align-items-flex-end"
      style={{
        borderBottom: '2px solid var(--gray-90)',
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