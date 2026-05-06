import "server-only";
import type { LoginData } from '@/lib/session';
import styles from '@/components/tables/tables.module.css' with { type: "css" };
import { ControlsMenu } from '@/components/elements/controls/controls';
import type { MetaRoadmap, Roadmap } from '@/types';
import accessChecker from '@/lib/accessChecker';
import serveTea from "@/lib/i18nServer";
import Link from 'next/link';
import type { ReactNode } from "react";

export default async function RoadmapTable({
  user,
  roadmaps,
  metaRoadmap,
}: { user: LoginData['user'] } & (
  | { roadmaps: Roadmap[]; metaRoadmap?: never; }
  | { roadmaps?: never; metaRoadmap: MetaRoadmap; }
)): Promise<ReactNode> {
  const t = await serveTea(["components", "common"]);
  
  // Failsafe in case wrong props are passed
  if (
    (!roadmaps && !metaRoadmap)
    || (roadmaps && metaRoadmap)
  ) throw new Error('RoadmapTable: Either `roadmaps` XOR `metaRoadmap` must be provided');

  const parsedRoadmaps: Roadmap[] = [];

  if (!roadmaps && metaRoadmap) {
    const stripRoadmapVersions = (metaRoadmap: MetaRoadmap): Roadmap["metaRoadmap"] => {
      const {
        roadmapVersions,
        ...interestingData
      } = metaRoadmap;
      return interestingData satisfies Roadmap["metaRoadmap"];
    };

    for (const roadmapVersion of metaRoadmap.roadmapVersions) {
      // The roadmap versions that come with metaRoadmap omit relations, therefor these empty arrays, sorry 
      parsedRoadmaps.push({
        ...roadmapVersion,
        metaRoadmap: stripRoadmapVersions(metaRoadmap),
        goals: [],
        actions: [],
        comments: [],
      });
    }
  }
  else {
    parsedRoadmaps.push(...roadmaps);
  }

  return <>
    {parsedRoadmaps.length ?
      <>
        {parsedRoadmaps.map(roadmap => {
          let typeAlias = roadmap.metaRoadmap.type.toString();
          if (roadmap.metaRoadmap.type === "NATIONAL") typeAlias = t("common:scope.national");
          else if (roadmap.metaRoadmap.type === "REGIONAL") typeAlias = t("common:scope.regional");
          else if (roadmap.metaRoadmap.type === "MUNICIPAL") typeAlias = t("common:scope.municipal");
          else if (roadmap.metaRoadmap.type === "LOCAL") typeAlias = t("common:scope.local");
          else if (roadmap.metaRoadmap.type === "OTHER") typeAlias = t("common:scope.other");

          const accessLevel = accessChecker(roadmap, user);
          return (
            <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
              <Link href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
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
              </Link>
              <ControlsMenu
                accessLevel={accessLevel}
                object={roadmap}
              />
            </div>
          );
        })}
      </>
      : <p>{t("components:roadmap_table.no_roadmap_versions_found")}</p>}
  </>;
}