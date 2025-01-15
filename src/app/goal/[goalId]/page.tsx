import { notFound } from "next/navigation";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker from "@/lib/accessChecker";
import { AccessControlled, AccessLevel } from "@/types";
import CombinedGraph from "@/components/graphs/combinedGraph";
import ActionGraph from "@/components/graphs/actionGraph";
import Link from "next/link";
import GraphGraph from "@/components/graphs/graphGraph";
import getOneGoal from "@/fetchers/getOneGoal";
import { Goal, DataSeries } from "@prisma/client";
import Comments from "@/components/comments/comments";
import getGoalByIndicator from "@/fetchers/getGoalByIndicator";
import getRoadmapByVersion from "@/fetchers/getRoadmapByVersion";
import prisma from "@/prismaClient";
import CopyAndScale from "@/components/modals/copyAndScale";
import { getTableContent } from "@/lib/pxWeb/getTableContent";
import filterTableContentKeys from "@/lib/pxWeb/filterTableContentKeys";
import { PxWebApiV2TableContent } from "@/lib/pxWeb/pxWebApiV2Types";
import QueryBuilder from "@/components/forms/pxWeb/queryBuilder";
import GraphCookie from "@/components/cookies/graphCookie";
import UpdateGoalButton from "@/components/buttons/updateGoalButton";
import getRoadmaps from "@/fetchers/getRoadmaps";
import EffectTable from "@/components/tables/effects.tsx";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { TableMenu } from "@/components/tables/tableMenu/tableMenu";

export default async function Page({
  params,
  searchParams,
}: {
  params: { goalId: string },
  searchParams: {
    secondaryGoal?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  },
}) {
  const [session, { goal, roadmap }, secondaryGoal, unfilteredRoadmapOptions] = await Promise.all([
    getSession(cookies()),
    getOneGoal(params.goalId).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.roadmapId) : null) } }),
    typeof searchParams.secondaryGoal == "string" ? getOneGoal(searchParams.secondaryGoal) : Promise.resolve(null),
    getRoadmaps(),
  ]);

  let accessLevel: AccessLevel = AccessLevel.None;
  if (goal) {
    const goalAccessData: AccessControlled = {
      author: goal.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic
    }
    accessLevel = accessChecker(goalAccessData, session.user);
  }

  // 404 if the goal doesn't exist or if the user doesn't have access to it
  if (!goal || !accessLevel || !roadmap) {
    return notFound();
  }

  // Create a list of roadmaps the user can copy and scale the goal to
  const roadmapOptions = unfilteredRoadmapOptions.filter(roadmap => {
    if (session.user?.isAdmin) return true;
    if (roadmap.authorId === session.user?.id) return true;
    if (roadmap.editors.some(editor => editor.id === session.user?.id)) return true;
    if (roadmap.editGroups.some(editGroup => session.user?.userGroups.some(userGroup => userGroup === editGroup.name))) return true;
    return false;
  }).map(roadmap => ({ id: roadmap.id, name: roadmap.metaRoadmap.name, version: roadmap.version, actor: roadmap.metaRoadmap.actor }))

  // Fetch external data
  let externalData: PxWebApiV2TableContent | null = null;
  if (goal.externalDataset && goal.externalTableId && goal.externalSelection) {
    externalData = await getTableContent(goal.externalTableId, JSON.parse(goal.externalSelection), goal.externalDataset).then(data => filterTableContentKeys(data));
  }

  // Fetch parent goal
  let parentGoal: Goal & { dataSeries: DataSeries | null } | null = null;
  if (roadmap?.metaRoadmap.parentRoadmapId) {
    try {
      // Get the parent roadmap (if any)
      const parentRoadmap = await getRoadmapByVersion(roadmap.metaRoadmap.parentRoadmapId,
        roadmap.targetVersion ||
        (await prisma.roadmap.aggregate({ where: { metaRoadmapId: roadmap.metaRoadmap.parentRoadmapId }, _max: { version: true } }))._max.version ||
        0);

      // If there is a parent roadmap, look for a goal with the same indicator parameter in it
      if (parentRoadmap) {
        parentGoal = await getGoalByIndicator(parentRoadmap.id, goal.indicatorParameter, goal.dataSeries?.unit);
      }
    } catch (error) {
      parentGoal = null;
      console.log(error);
    }
  }

  // If any goalParent has a data series with a later updatedAt date than the goal, the goal should be updated
  let shouldUpdate = false;
  if (goal.combinationParents) {
    for (const parent of goal.combinationParents) {
      if (parent.parentGoal.dataSeries?.updatedAt && parent.parentGoal.dataSeries.updatedAt > (goal.dataSeries?.updatedAt ?? new Date(0))) {
        shouldUpdate = true;
        break;
      }
    }
  }

  return (
    <>
      <Breadcrumb object={goal} />

      {secondaryGoal && <p className="margin-block-300">Jämför med målbanan {secondaryGoal.name || secondaryGoal.indicatorParameter}</p>}
      <section className={`margin-top-300`}>
        {/* TODO: Add a way to exclude actions by unchecking them in a list or something. Might need to be moved to a client component together with ActionGraph */}
        <GraphGraph goal={goal} nationalGoal={parentGoal} historicalData={externalData} secondaryGoal={secondaryGoal} effects={goal.effects}>
          {(goal.dataSeries?.id && session.user) ?
            <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
          : null }
          <GraphCookie />
        </GraphGraph>
      </section>

      <section className="margin-block-100 padding-top-100" style={{ borderTop: '2px solid var(--gray-90)' }}>
        <div className="flex flex-wrap-wrap justify-content-space-between gap-100">
          <div>
            <span style={{ color: 'gray' }}>Målbana</span>
            {goal.name ? (
              <h2 className="margin-0" style={{ fontSize: '2rem' }}>{goal.name}</h2>
            ) : (
              <h2 className="margin-0">{goal.indicatorParameter}</h2>
            )}
          </div>
          {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
            <div className="flex flex-wrap-wrap align-items-center gap-100">
              <QueryBuilder goal={goal} />
              {shouldUpdate &&
                <UpdateGoalButton id={goal.id} />
              }
              <TableMenu
                accessLevel={accessLevel}
                object={goal}
              />
            </div>
          }
        </div>
        <p className="container-text">{goal.description}</p>
        {goal.dataSeries?.scale &&
          <p>Alla värden i målbanan använder följande skala: {`"${goal.dataSeries?.scale}"`}</p>
        }
        <h2 className="margin-bottom-0 margin-top-200" style={{fontSize: '1.25rem'}}>Externa resurser</h2>
        <ul>
          {goal.links.map((link: { url: string, description: string | null }, index: number) => 
            <li className="margin-block-25" key={index}>
              <a href={link.url} target="_blank">{link.description}</a>
            </li>
          )}
        </ul>
      </section>

      <section className="margin-block-300">
        <h2>Kombinerad graf</h2>
        <CombinedGraph roadmap={roadmap} goal={goal} />
      </section>

      <section>
        <div className="flex align-items-center justify-content-space-between">
          <h2>Åtgärder</h2>
          {([AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit].includes(accessLevel)) &&
            <div className="flex gap-50">
              <Link href={`/effect/create?goalId=${goal.id}`} className="button color-purewhite pureblack round font-weight-bold">Koppla till en existerande åtgärd</Link>
              <Link href={`/action/create?roadmapId=${goal.roadmapId}&goalId=${goal.id}`} className="button color-purewhite pureblack round font-weight-bold">Skapa ny åtgärd</Link>
            </div>
          }
        </div>

        <div className="margin-block-100">
          <ActionGraph actions={goal.effects.map(effect => effect.action)} />
        </div>
        <EffectTable object={goal} accessLevel={accessLevel} />
      </section>
      <Comments comments={goal.comments} objectId={goal.id} />
    </>
  )
}