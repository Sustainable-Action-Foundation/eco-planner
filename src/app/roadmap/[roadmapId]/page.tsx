import { notFound } from "next/navigation";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import accessChecker from "@/lib/accessChecker";
import Goals from "@/components/tables/goals";
import Comments from "@/components/comments/comments";
import { AccessLevel } from "@/types";
import ThumbnailGraph from "@/components/graphs/mainGraphs/thumbnailGraph";

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
    {roadmap.description ? (
      <p>{roadmap.description}</p>
    ): null}
    
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
            ): null }
          </div>
          : null
      )}

    </div>


    <Goals title="Målbanor" roadmap={roadmap} accessLevel={accessLevel} />
    <Comments comments={roadmap.comments} objectId={roadmap.id} />
  </>
}