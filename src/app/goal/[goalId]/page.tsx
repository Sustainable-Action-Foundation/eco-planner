import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import UpdateGoalButton from "@/components/buttons/updateGoalButton";
import Comments from "@/components/comments/comments";
import QueryBuilder from "@/components/forms/pxWeb/queryBuilder";
import ActionGraph from "@/components/graphs/actionGraph";
import ChildGraphContainer from "@/components/graphs/childGraphs/childGraphContainer.tsx";
import GraphGraph from "@/components/graphs/graphGraph";
import SiblingGraph from "@/components/graphs/siblingGraph";
import CopyAndScale from "@/components/modals/copyAndScale";
import EffectTable from "@/components/tables/effects.tsx";
import { TableMenu } from "@/components/tables/tableMenu/tableMenu";
import getGoalByIndicator from "@/fetchers/getGoalByIndicator";
import getOneGoal from "@/fetchers/getOneGoal";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import getRoadmapByVersion from "@/fetchers/getRoadmapByVersion";
import getRoadmaps from "@/fetchers/getRoadmaps";
import findSiblings from "@/functions/findSiblings.ts";
import accessChecker from "@/lib/accessChecker";
import { ApiTableContent } from "@/lib/api/apiTypes";
import { getPxWebTableContent } from "@/lib/pxWeb/getPxWebTableContent";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";

export async function generateMetadata({
  params,
 }: {
  params: { goalId: string },
}){
  const [{goal}] = await Promise.all([
    getOneGoal(params.goalId).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.roadmapId) : null) } }),
  ]);

  const metadata: Metadata = {
    title: `${goal?.name} - Eco - Planner`,
    icons: "/icons/leaf.svg",
    description: `${goal?.description || 'Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.'}`,
    openGraph: {
      title: `${goal?.name} - Eco - Planner`,
      type: 'website',
      url: baseUrl,
      images: [{
        url: `${baseUrl}/images/solarpanels.jpg`
      }],
      siteName: 'Eco - Planner',
      description: `${goal?.description || 'Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.'}`,
      locale: 'sv_SE'
    }
  }

  return metadata
}

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
  let externalData: ApiTableContent | null = null;
  if (goal.externalDataset && goal.externalTableId && goal.externalSelection) {
    externalData = await getPxWebTableContent(goal.externalTableId, JSON.parse(goal.externalSelection), goal.externalDataset);
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

  // Get goals with same indicator parameter in roadmaps working towards the one containing current goal
  // TODO: If multiple roadmaps in a series work towards the same target, maybe only count the one with the highest version?
  const childRoadmaps = unfilteredRoadmapOptions.filter(child => child.metaRoadmap.parentRoadmapId === roadmap.metaRoadmap.id).filter(child => child.targetVersion === roadmap.version || !child.targetVersion);
  let childGoals: (NonNullable<Awaited<ReturnType<typeof getGoalByIndicator>>> & { roadmapName?: string })[] = [];
  if (childRoadmaps.length > 0) {
    const goals = await Promise.all(childRoadmaps.map(async roadmap => {
      return getGoalByIndicator(roadmap.id, goal.indicatorParameter, goal.dataSeries?.unit || undefined);
    }));
    childGoals = goals.filter(child => child !== null);
    for (const child of childGoals) {
      child.roadmapName = childRoadmaps.find(roadmap => roadmap.id === child.roadmapId)?.metaRoadmap.name;
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
      <main>
        {shouldUpdate &&
          <section
            className="flex justify-content-space-between align-items-center margin-block-300 padding-25 rounded"
            style={{ border: '1px solid gold', backgroundColor: 'rgba(255, 255, 0, .35)' }}
          >
            <div className="flex align-items-center gap-100 margin-left-100">
              <Image src="/icons/alert.svg" alt="" width={24} height={24} />
              <strong className="font-weight-500">Uppdatera din målbana för att få senaste informationen.</strong>
            </div>
            <UpdateGoalButton id={goal.id} />
          </section>
        }

        <section className="margin-block-300">
          {goal.name ? (
            <>
              <small style={{ color: 'gray' }}>Målbana</small>
              <div className="flex align-items-center justify-content-space-between gap-100">
                <h1 className="margin-0" style={{ fontSize: '3rem', lineHeight: '1' }}>{goal.name}</h1>
                <label className="flex gap-50 align-items-center">
                  <span className="font-weight-500">Meny</span>
                  {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
                    <TableMenu
                      width={24}
                      height={24}
                      accessLevel={accessLevel}
                      object={goal}
                    />
                  }
                </label>
              </div>
              <small style={{ color: 'gray' }}>{goal.indicatorParameter}</small>
            </>
          ) :
            <>
              <small style={{ color: 'gray' }}>Målbana</small>
              <div className="flex align-items-center justify-content-space-between">
                <h1 className="margin-0" style={{ lineHeight: '1' }}>{goal.indicatorParameter}</h1>
                <label className="flex gap-50 align-items-center">
                  <span className="font-weight-500">Meny</span>
                  {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
                    <TableMenu
                      width={24}
                      height={24}
                      accessLevel={accessLevel}
                      object={goal}
                    />
                  }
                </label>
              </div>
            </>
          }

          {goal.description ?
            <>
              <h2 className="margin-top-200 margin-bottom-0">Beskrivning</h2>
              <p className="container-text">{goal.description}</p>
            </>
            : null}

          {goal.links.length > 0 ?
            <>
              <h3 className="margin-bottom-0 margin-top-200" >Externa resurser</h3>
              <ul>
                {goal.links.map((link: { url: string, description: string | null }, index: number) =>
                  <li className="margin-block-25" key={index}>
                    <a href={link.url} target="_blank">{link.description}</a>
                  </li>
                )}
              </ul>
            </>
            : null}
        </section>

        <section className='margin-top-300'>
          <h2 className="padding-bottom-50 margin-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>Målbana</h2>
          <section>
            {/* TODO: Add a way to exclude actions by unchecking them in a list or something. Might need to be moved to a client component together with ActionGraph */}
            <GraphGraph goal={goal} nationalGoal={parentGoal} historicalData={externalData} secondaryGoal={secondaryGoal} effects={goal.effects}>
              <QueryBuilder goal={goal} />
              {(goal.dataSeries?.id && session.user) ?
                <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
                : null}
            </GraphGraph>

            {goal.dataSeries?.scale &&
              <>
                <p>Alla värden i målbanan använder följande skala: {`"${goal.dataSeries?.scale}"`}</p>
                {[AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit].includes(accessLevel) &&
                  <strong>Vänligen baka in skalan i värdet eller enheten; skalor kommer att tas bort i framtiden</strong>
                }
              </>
            }
          </section>

          <section className="margin-block-300">
            <div
              className='margin-bottom-100 padding-bottom-50 flex justify-content-space-between align-items-center gap-100 flex-wrap-wrap'
              style={{ borderBottom: '1px solid var(--gray)' }}>
              <h3 className='margin-0 font-weight-600' style={{ fontSize: '1.1rem' }}>
                Åtgärder som jobbar mot denna målbana
              </h3>

              {([AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit].includes(accessLevel)) &&
                <menu className="margin-0 padding-0 flex justify-content-flex-end gap-25">
                  <Link
                    href={`/effect/create?goalId=${goal.id}`}
                    className="button smooth font-weight-500"
                    style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                    Koppla till existerande åtgärd
                  </Link>
                  <Link
                    href={`/action/create?roadmapId=${goal.roadmapId}&goalId=${goal.id}`}
                    className="button smooth seagreen color-purewhite"
                    style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
                    Skapa ny åtgärd
                  </Link>
                </menu>
              }
            </div>

            {/* TODO: rename to effectslist? */}
            <EffectTable object={goal} accessLevel={accessLevel} />

            {goal.effects.some(effect => effect.action.startYear || effect.action.endYear) &&
              <>
                <h4 className="margin-top-500 font-weight-500">
                  Tidslinje
                </h4>
                <article className="smooth purewhite margin-bottom-500" style={{ border: '1px solid var(--gray-90)' }}>
                  <ActionGraph actions={goal.effects.map(effect => effect.action)} />
                </article>
              </>
            }
          </section>
        </section>

        {childGoals.length > 0 ?
          <section className="margin-block-300">
            <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>
              Målbanor som jobbar mot {goal.name || goal.indicatorParameter}
            </h2>
            <ChildGraphContainer goal={goal} childGoals={childGoals} />
          </section>
          : null
        }

        {findSiblings(roadmap, goal).length > 1 ?
          <section className="margin-block-300">
            <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>
              Angränsande målbanor
            </h2>
            <SiblingGraph roadmap={roadmap} goal={goal} />
          </section>
          : null
        }

      </main>

      <section className="margin-block-500">
        <Comments comments={goal.comments} objectId={goal.id} />
      </section>

    </>
  )
}