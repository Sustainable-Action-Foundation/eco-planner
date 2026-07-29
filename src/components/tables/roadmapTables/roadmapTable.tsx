import "server-only";
import type { MultiRoadmapInstance, Roadmap, UserAccessContext } from "@/types";
import styles from '@/components/tables/tables.module.css' with { type: "css" };
import { ControlsMenu } from '@/components/elements/controls/controls';
import accessChecker from '@/lib/accessChecker';
import serveTea from "@/lib/i18nServer";
import Link from 'next/link';
import type { ReactNode } from "react";

/** The iteration shape this table renders; `MultiRoadmapInstance` satisfies it. */
type TableIteration = Omit<MultiRoadmapInstance, "_count"> & { _count: { goals: number } };

export default async function RoadmapTable({
  accessContext,
  iterations,
  roadmap,
}: { accessContext: UserAccessContext | null } & (
  | { iterations: MultiRoadmapInstance[]; roadmap?: never; }
  | { iterations?: never; roadmap: Roadmap; }
)): Promise<ReactNode> {
  const t = await serveTea(["components", "common"]);

  // Failsafe in case wrong props are passed
  if (
    (!iterations && !roadmap)
    || (iterations && roadmap)
  ) throw new Error('RoadmapTable: Either `iterations` XOR `roadmap` must be provided');

  const parsedIterations: TableIteration[] = [];

  if (!iterations && roadmap) {
    const stripIterations = (roadmap: Roadmap): TableIteration["roadmap"] => {
      const {
        iterations,
        ...interestingData
      } = roadmap;
      return interestingData satisfies TableIteration["roadmap"];
    };

    for (const iteration of roadmap.iterations) {
      parsedIterations.push({
        ...iteration,
        roadmap: stripIterations(roadmap),
      });
    }
  }
  else {
    parsedIterations.push(...iterations);
  }

  return parsedIterations.length
    ? parsedIterations.map(iteration => {
      let typeAlias = iteration.roadmap.type.toString();
      if (iteration.roadmap.type === "NATIONAL") typeAlias = t("common:scope.national");
      else if (iteration.roadmap.type === "REGIONAL") typeAlias = t("common:scope.regional");
      else if (iteration.roadmap.type === "MUNICIPAL") typeAlias = t("common:scope.municipal");
      else if (iteration.roadmap.type === "LOCAL") typeAlias = t("common:scope.local");
      else if (iteration.roadmap.type === "OTHER") typeAlias = t("common:scope.other");

      const accessLevel = accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext);
      return (
        <div className='flex gap-100 justify-content-space-between align-items-center' key={iteration.id}>
          <Link href={`/roadmapIteration/${iteration.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
            {/* Name, version */}
            <span className={styles.linkTitle}>
              {t("components:roadmap_table.title", { name: iteration.roadmap.name, version: iteration.version })}
            </span>
            {/* Type, goal count */}
            <span className={styles.linkInfo}>
              {typeAlias}
              &nbsp;&middot;&nbsp;
              {t("common:count.goal", { count: iteration._count.goals })}
            </span>
          </Link>
          <ControlsMenu
            accessLevel={accessLevel}
            object={iteration}
          />
        </div>
      );
    })
    : <p>{t("components:roadmap_table.no_roadmap_versions_found")}</p>;
}
