import { notFound } from "next/navigation";
import Tooltip from "@/lib/tooltipWrapper";
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
    <p>{roadmap.description}</p>

    <div
      className="grid gap-100 margin-block-100 padding-block-100 align-items-flex-end"
      style={{
        borderBottom: '2px solid var(--gray-90)',
        gridTemplateColumns: 'repeat(auto-fit, 300px)'
      }}
    >
      {roadmap.goals.map((goal, key) =>
        goal.isFeatured ?
          <div key={key}>
            <h3 style={{ textAlign: 'center' }}>{goal.name}</h3>
            <a href={`/goal/${goal.id}`}>
              <ThumbnailGraph goal={goal} />
            </a>
          </div>
          : null
      )}

    </div>


    <Goals title="Målbanor" roadmap={roadmap} accessLevel={accessLevel} />
    <Comments comments={roadmap.comments} objectId={roadmap.id} />
    <Tooltip anchorSelect="#goalName">
      Beskrivning av vad målbanan beskriver, tex. antal bilar.
    </Tooltip>
    <Tooltip anchorSelect="#goalObject">
      Målobjektet är den som &quot;äger&quot; ett mål, exempelvis en kommun, region eller organisation.
    </Tooltip>
    <Tooltip anchorSelect="#leapParameter">
      LEAP parametern beskriver vad som mäts, exempelvis energianvändning eller utsläpp av växthusgaser.
    </Tooltip>
    <Tooltip anchorSelect="#dataUnit">
      Beskriver vilken enhet värdena i dataserien är i.
    </Tooltip>
    <Tooltip anchorSelect="#goalActions">
      Antal åtgärder som finns definierade och kopplade till målbanan.
    </Tooltip>
  </>
}