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

export default function RoadmapTree({
  roadmaps,
  user,
}: RoadmapTreeProps) {
  if (!roadmaps.length) {
    return (<p>Inga färdplaner hittades. Om du har några filter aktiva så hittade inga färdplaner som matchar dem.</p>);
  }

  const childRoadmaps = roadmaps.filter(roadmap => roadmap.metaRoadmap.parentRoadmapId == null);

  return <ul className={styles.list}>
    <NestedRoadmapRenderer allRoadmaps={roadmaps} childRoadmaps={childRoadmaps} user={user} />
  </ul>
}

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
      const childRoadmaps = allRoadmaps.filter(current => (current.metaRoadmap.parentRoadmapId === roadmap.metaRoadmapId) && (current.id !== roadmap.id) && (current.metaRoadmap.parentRoadmapId != null));

      return <li key={`roadmap-tree-${roadmap.id}`}>
        <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
          <a href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
            <span className={styles.linkTitle}>{`${roadmap.metaRoadmap.name} (v${roadmap.version})`}</span>
            <span className={styles.linkInfo}>{roadmap.metaRoadmap.type} • {roadmap._count.goals} Målbanor</span>
          </a>
          <TableMenu
            accessLevel={accessLevel}
            object={roadmap}
          />
        </div>
        {childRoadmaps.length > 0 ?
          <ul className={styles.list}>
            <NestedRoadmapRenderer allRoadmaps={allRoadmaps} childRoadmaps={childRoadmaps} user={user} />
          </ul>
          : null
        }
      </li>
    })}
  </>
}