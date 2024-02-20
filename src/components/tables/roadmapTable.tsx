import { Data } from '@/lib/session';
import styles from './tables.module.css' with { type: "css" };
import { MetaRoadmap, Roadmap } from "@prisma/client";
import Image from 'next/image';
import Link from 'next/link';
import { RoadmapActionButton } from './tableActions/roadmapActions';

interface RoadmapTableCommonProps {
  title: String,
  user: Data['user'],
}

interface RoadmapTableWithMetaRoadmap extends RoadmapTableCommonProps {
  roadmaps?: never,
  metaRoadmap: MetaRoadmap & { roadmapVersions: { id: string, version: number, _count: { goals: number } }[] }
}

interface RoadmapTableWithRoadmaps extends RoadmapTableCommonProps {
  roadmaps: ({ id: string, version: number, _count: { goals: number }, metaRoadmap: MetaRoadmap })[],
  metaRoadmap?: never,
}

type RoadmapTableProps = RoadmapTableWithMetaRoadmap | RoadmapTableWithRoadmaps;

export default function RoadmapTable({
  title,
  roadmaps,
  user,
  metaRoadmap,
}: RoadmapTableProps) {
  // Failsafe in case wrong props are passed
  if ((!roadmaps && !metaRoadmap) || (roadmaps && metaRoadmap)) throw new Error('RoadmapTable: Either `roadmaps` XOR `metaRoadmap` must be provided');

  let creationLink = '/metaRoadmap/createMetaRoadmap';

  if (!roadmaps) {
    roadmaps = metaRoadmap.roadmapVersions.map((version) => {
      return {
        id: version.id,
        version: version.version,
        _count: { goals: version._count.goals },
        // Sets the metaRoadmap to the parent metaRoadmap, excluding the versions array
        metaRoadmap: (({ roadmapVersions, ...data }) => data)(metaRoadmap)
      }
    })
    // Set the creation link to create a new roadmap version for the specified meta roadmap instead
    creationLink = `/roadmap/createRoadmap?metaRoadmapId=${metaRoadmap.id}`

  }

  return <>
    {roadmaps.length ?
      <div>
        {roadmaps.map(roadmap => (
          <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
            <a href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
              <span className={styles.linkTitle}>{roadmap.metaRoadmap.name}</span>
              <span className={styles.linkInfo}>{roadmap.metaRoadmap.type} • {roadmap._count.goals} Målbanor</span>
            </a>
            <RoadmapActionButton
              addGoalHref={`/roadmap/${roadmap.id}/goal/createGoal`}
              editHref={`/roadmap/${roadmap.id}/editRoadmap`}
              id={roadmap.id}
              tableName={roadmap.metaRoadmap.name}
            />
            <span>v.{roadmap.version}</span> {/* TODO: Turn into link */}
          </div>
        ))}
      </div>
      : <p>Inga färdplaner hittades. Detta kan bero på ett problem med databasen</p>}
  </>
}