"use server";

import { LoginData } from '@/lib/session';
import styles from '@/components/tables/tables.module.css' with { type: "css" };
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { TableMenu } from '@/components/tables/tableMenu/tableMenu';
import { AccessControlled } from '@/types';
import accessChecker from '@/lib/accessChecker';
import serveTea from "@/lib/i18nServer";

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

export default async function RoadmapTable({
  user,
  roadmaps,
  metaRoadmap,
}: RoadmapTableProps) {
  const t = await serveTea(["components", "common"]);
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
        // Sets the metaRoadmap to the parent metaRoadmap, excluding the versions array
        metaRoadmap: (({ roadmapVersions, ...data }) => data)(metaRoadmap),
      }
    });
  }

  return <>
    {roadmaps.length ?
      <>
        {roadmaps.map(roadmap => {
          let typeAlias = roadmap.metaRoadmap.type.toString();
          if (roadmap.metaRoadmap.type === "NATIONAL") typeAlias = t("common:scope.national");
          else if (roadmap.metaRoadmap.type === "REGIONAL") typeAlias = t("common:scope.regional");
          else if (roadmap.metaRoadmap.type === "MUNICIPAL") typeAlias = t("common:scope.municipal");
          else if (roadmap.metaRoadmap.type === "LOCAL") typeAlias = t("common:scope.local");
          else if (roadmap.metaRoadmap.type === "OTHER") typeAlias = t("common:scope.other");

          const accessLevel = accessChecker(roadmap, user);
          return (
            <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
              <a href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
                {/* Name, version */}
                <span className={styles.linkTitle}>
                  {t("components:roadmap_table.title", { name: roadmap.metaRoadmap.name, version: roadmap.version })}
                </span>
                {/* Type, goal count */}
                <span className={styles.linkInfo}>
                  {typeAlias}
                  {" • "}
                  {t("common:count.goal", { count: roadmap._count.goals })}
                </span>
              </a>
              <TableMenu
                accessLevel={accessLevel}
                object={roadmap}
              />
            </div>
          )
        })}
      </>
      : <p>{t("components:roadmap_table.no_roadmap_versions_found")}</p>}
  </>
}