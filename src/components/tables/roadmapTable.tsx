import { LoginData } from '@/lib/session';
import styles from './tables.module.css' with { type: "css" };
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { TableMenu } from './tableMenu/tableMenu';
import { AccessControlled } from '@/types';
import accessChecker from '@/lib/accessChecker';

interface RoadmapTableCommonProps {
  user: LoginData['user'],
}

interface RoadmapTableWithMetaRoadmap extends RoadmapTableCommonProps {
  roadmaps?: never,
  metaRoadmap: MetaRoadmap & AccessControlled & { roadmapVersions: (Roadmap & AccessControlled & { id: string, version: number, _count: { goals: number } })[] }
}

interface RoadmapTableWithRoadmaps extends RoadmapTableCommonProps {
  roadmaps: (Roadmap & AccessControlled & { id: string, version: number, _count: { goals: number }, metaRoadmap: MetaRoadmap })[],
  metaRoadmap?: never,
}

type RoadmapTableProps = RoadmapTableWithMetaRoadmap | RoadmapTableWithRoadmaps;

export default function RoadmapTable({
  user,
  roadmaps,
  metaRoadmap,
}: RoadmapTableProps) {
  // Failsafe in case wrong props are passed
  if ((!roadmaps && !metaRoadmap) || (roadmaps && metaRoadmap)) throw new Error('RoadmapTable: Either `roadmaps` XOR `metaRoadmap` must be provided');

  if (!roadmaps) {
    // Between Typescript version 5.3.3 and 5.4.4 there was a change where the type of `metaRoadmap` stopped being inferred as `NonNullable<typeof metaRoadmap>`.
    // We can claim that `metaRoadmap` is `NonNullable<typeof metaRoadmap>` since the program will throw if both `roadmaps` and `metaRoadmap` are undefined.
    metaRoadmap = metaRoadmap as NonNullable<typeof metaRoadmap>;
    roadmaps = metaRoadmap.roadmapVersions.map((version) => {
      metaRoadmap = metaRoadmap as NonNullable<typeof metaRoadmap>;
      return {
        ...version,
        // id: version.id,
        // version: version.version,
        // _count: { goals: version._count.goals },
        // Sets the metaRoadmap to the parent metaRoadmap, excluding the versions array
        metaRoadmap: (({ roadmapVersions, ...data }) => data)(metaRoadmap),
        // author: [version.author as { id: string, username: string }, metaRoadmap.author as { id: string, username: string }],
        // editors: version.editors,
        // viewers: version.viewers,
        // editGroups: version.editGroups,
        // viewGroups: version.viewGroups,
        // isPublic: version.isPublic,
      }
    });
  }

  return <>
    {roadmaps.length ?
      <>
        {roadmaps.map(roadmap => {
          const accessLevel = accessChecker(roadmap, user);
          return (
            <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
              <a href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
                <span className={styles.linkTitle}>{roadmap.metaRoadmap.name}</span>
                <span className={styles.linkInfo}>{roadmap.metaRoadmap.type} • {roadmap._count.goals} Målbanor</span>
              </a>
              <TableMenu
                accessLevel={accessLevel}
                object={roadmap}
              />
              <a href={`/metaRoadmap/${roadmap.metaRoadmap.id}`}>v.{roadmap.version}</a>
            </div>
          )
        })}
      </>
      : <p>Inga färdplaner hittades. Om du har några filter aktiva så hittades inga färdplaner som matchar dem.</p>}
  </>
}