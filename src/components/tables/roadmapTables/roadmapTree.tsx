import "server-only";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { TableMenu } from "@/components/tables/tableMenu/tableMenu.tsx";
import accessChecker from "@/lib/accessChecker.ts";
import { LoginData } from "@/lib/session.ts";
import { AccessControlled } from "@/types.ts";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import Link from "next/link";
import { Fragment } from "react";
import serveTea from "@/lib/i18nServer";
import { IconCaretRightFilled } from "@tabler/icons-react";

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
export default async function RoadmapTree({
  roadmaps,
  user,
}: RoadmapTreeProps) {
  const t = await serveTea("components");
  if (!roadmaps.length) {
    return <p>{t("components:roadmap_tree.no_roadmap_series_ones")}</p>;
  }

  const accessibleMetaRoadmaps = roadmaps.map(roadmap => roadmap.metaRoadmapId);

  // All roadmaps without a parent or with a parent the user does not have access to are placed at the top level
  const topLevelRoadmaps = roadmaps.filter(roadmap => (roadmap.metaRoadmap.parentRoadmapId == null) || (!accessibleMetaRoadmaps.includes(roadmap.metaRoadmap.parentRoadmapId)));

  return (
    <nav>
      <ul className={`${styles['roadmap-nav-ul']}`} style={{ paddingInlineStart: '0' }}>
        <NestedRoadmapRenderer allRoadmaps={roadmaps} childRoadmaps={topLevelRoadmaps} user={user} />
      </ul>
    </nav>
  )
}

/**
 * Does the nesting of roadmaps for the `RoadmapTree` component.
 */
async function NestedRoadmapRenderer({
  allRoadmaps,
  childRoadmaps,
  user,
}: {
  allRoadmaps: RoadmapTreeProps['roadmaps'],
  childRoadmaps: RoadmapTreeProps['roadmaps'],
  user: RoadmapTreeProps['user'],
}) {
  const t = await serveTea(["components", "common"]);
  return <>
    {childRoadmaps.map(roadmap => {
      let typeAlias = roadmap.metaRoadmap.type.toString();
      if (roadmap.metaRoadmap.type === "NATIONAL") typeAlias = t("common:scope.national");
      else if (roadmap.metaRoadmap.type === "REGIONAL") typeAlias = t("common:scope.regional");
      else if (roadmap.metaRoadmap.type === "MUNICIPAL") typeAlias = t("common:scope.municipal");
      else if (roadmap.metaRoadmap.type === "LOCAL") typeAlias = t("common:scope.local");
      else if (roadmap.metaRoadmap.type === "OTHER") typeAlias = t("common:scope.other");

      const accessLevel = accessChecker(roadmap, user);
      const newChildRoadmaps = allRoadmaps.filter(potentialChild => (potentialChild.metaRoadmap.parentRoadmapId === roadmap.metaRoadmapId) && (potentialChild.id !== roadmap.id) && (potentialChild.metaRoadmap.parentRoadmapId != null));

      return (
        <Fragment key={`roadmap-tree-${roadmap.id}`}>
          {newChildRoadmaps.length > 0 ?
            <li>
              <details>
                {/* TODO: In accesibility tree, this shows as the link being labeled under "visa underliggande färdplaner" */}
                <summary className="flex justify-content-space-between" aria-label={t("components:roadmap_tree.show_source_alt")}>
                  <div className='inline-flex align-items-center flex-grow-100' key={roadmap.id}> {/* TODO: Do i need this key here?  */}
                    <IconCaretRightFilled aria-hidden="true" className="round padding-25 margin-inline-25" />
                    <Link href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth' style={{ lineHeight: '1' }}>
                      {/* Name, version */}
                      <div>
                        {t("components:roadmap_tree.title", { name: roadmap.metaRoadmap.name, version: roadmap.version })}
                      </div>
                      {/* Type, goal count */}
                      <div className={styles["roadmap-information"]}>
                        {typeAlias}
                        {" • "}
                        {t("common:count.goal", { count: roadmap._count.goals })}
                      </div>
                    </Link>
                  </div>
                  <span className="flex align-items-center padding-inline-25">
                    <TableMenu
                      accessLevel={accessLevel}
                      object={roadmap}
                    />
                  </span>
                </summary>

                <ul className={styles['roadmap-nav-ul']}>
                  <NestedRoadmapRenderer allRoadmaps={allRoadmaps} childRoadmaps={newChildRoadmaps} user={user} />
                </ul>
              </details>
            </li>
            :
            <li className="inline-flex align-items-center flex-grow-100 width-100">
              <div className='inline-flex align-items-center flex-grow-100' key={roadmap.id}>
                <IconCaretRightFilled aria-hidden="true" color="lightgray" className="round padding-25 margin-inline-25" />
                <Link href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth' style={{ lineHeight: '1' }}>
                  {/* Name, version */}
                  <div>
                    {t("components:roadmap_tree.title", { name: roadmap.metaRoadmap.name, version: roadmap.version })}
                  </div>
                  {/* Type, goal count */}
                  <div className={styles["roadmap-information"]}>
                    {typeAlias}
                    {" • "}
                    {t("common:count.goal", { count: roadmap._count.goals })}
                  </div>
                </Link>
              </div>
              <span className="flex align-items-center padding-inline-25">
                <TableMenu
                  accessLevel={accessLevel}
                  object={roadmap}
                />
              </span>
            </li>
          }
        </Fragment>
      )
    })}
  </>
}