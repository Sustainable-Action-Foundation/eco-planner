import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { TableMenu } from "@/components/tables/tableMenu/tableMenu.tsx";
import accessChecker from "@/lib/accessChecker.ts";
import { LoginData } from "@/lib/session.ts";
import { AccessControlled } from "@/types.ts";
import { MetaRoadmap, Roadmap } from "@prisma/client";

type RoadmapTreeProps = {
  user: LoginData['user'],
  roadmaps: (Roadmap & AccessControlled & { _count: { goals: number }, metaRoadmap: MetaRoadmap & { childRoadmaps: { id: string }[] } })[],
}

/**
 * Renders given roadmaps in a tree structure. Roadmaps belonging to a MetaRoadmap without a(n accessible) parent are placed at the top level.
 * Other roadmaps are recursively nested under the current roadmap based on their MetaRoadmap's parentRoadmapId.
 * 
 * Ignores which roadmap versions work towards which other versions; only MetaRoadmap relationships are considered.
 */
export default function RoadmapTree({
  roadmaps,
  user,
}: RoadmapTreeProps) {
  if (!roadmaps.length) {
    return <p>Inga färdplaner hittades. Om du har några filter aktiva så hittade inga färdplaner som matchar dem.</p>;
  }

  const accessibleMetaRoadmaps = roadmaps.map(roadmap => roadmap.metaRoadmapId);

  // All roadmaps without a parent or with a parent the user does not have access to are placed at the top level
  const topLevelRoadmaps = roadmaps.filter(roadmap => (roadmap.metaRoadmap.parentRoadmapId == null) || (!accessibleMetaRoadmaps.includes(roadmap.metaRoadmap.parentRoadmapId)));

  return ( 
    <ul className={`${styles.ul}`} style={{paddingInlineStart: '0'}}>
      <NestedRoadmapRenderer allRoadmaps={roadmaps} childRoadmaps={topLevelRoadmaps} user={user} />
    </ul>
  )
}

/**
 * Does the nesting of roadmaps for the `RoadmapTree` component.
 */
function NestedRoadmapRenderer({
  allRoadmaps,
  childRoadmaps,
  user,
}: {
  allRoadmaps: RoadmapTreeProps['roadmaps'],
  childRoadmaps: RoadmapTreeProps['roadmaps'],
  user: RoadmapTreeProps['user'],
}) {
  return <>
    {childRoadmaps.map(roadmap => {
      const accessLevel = accessChecker(roadmap, user);
      const newChildRoadmaps = allRoadmaps.filter(potentialChild => (potentialChild.metaRoadmap.parentRoadmapId === roadmap.metaRoadmapId) && (potentialChild.id !== roadmap.id) && (potentialChild.metaRoadmap.parentRoadmapId != null));

      return ( 
        <>
          {newChildRoadmaps.length > 0 ?
            <li key={`roadmap-tree-${roadmap.id}`}>
              <details>
                <summary className="flex justify-content-space-between">
                  <div className='inline-flex align-items-center flex-grow-100' key={roadmap.id}>
                    <img src="/icons/caret-right.svg" width="24" height="24" className="round padding-25 margin-inline-25"/>
                    <a href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth'>
                      <div style={{lineHeight: '1'}}>
                          {`${roadmap.metaRoadmap.name} (v${roadmap.version})`} <br /> 
                          <span>{roadmap.metaRoadmap.type} • {roadmap._count.goals} målbanor</span>
                      </div>
                    </a> 
                  </div>
                  <span className="flex align-items-center padding-inline-25">
                    <TableMenu
                      accessLevel={accessLevel}
                      object={roadmap}
                    />
                  </span>
                </summary>

                <ul className={styles.ul}>
                  <NestedRoadmapRenderer allRoadmaps={allRoadmaps} childRoadmaps={newChildRoadmaps} user={user} />
                </ul>
              </details>
            </li>
            : 
              <li className="inline-flex align-items-center flex-grow-100 width-100">
                <div className='inline-flex align-items-center flex-grow-100' key={roadmap.id}>
                  <img src="/icons/caret-right-gray.svg" width="24" height="24" className="round padding-25 margin-inline-25"/>
                  <a href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth'>
                    <div style={{lineHeight: '1'}}>
                        {`${roadmap.metaRoadmap.name} (v${roadmap.version})`} <br /> 
                        <span>{roadmap.metaRoadmap.type} • {roadmap._count.goals} målbanor</span>
                    </div>
                  </a> 
                </div>
                <span className="flex align-items-center padding-inline-25">
                  <TableMenu
                    accessLevel={accessLevel}
                    object={roadmap}
                  />
                </span>
              </li>
            }
          </>
        )
    })}
  </>
}