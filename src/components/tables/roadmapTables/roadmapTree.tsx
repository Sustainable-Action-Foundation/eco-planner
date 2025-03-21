import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { TableMenu } from "@/components/tables/tableMenu/tableMenu.tsx";
import accessChecker from "@/lib/accessChecker.ts";
import { LoginData } from "@/lib/session.ts";
import { AccessControlled } from "@/types.ts";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import { t } from "@/lib/i18nServer";

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
    return <p>{t("components:roadmap_tree.no_meta_roadmap_ones")}</p>;
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
        <Fragment key={`roadmap-tree-${roadmap.id}`}>
          {newChildRoadmaps.length > 0 ?
            <li>
              <details>
                <summary className="flex justify-content-space-between">
                  <div className='inline-flex align-items-center flex-grow-100' key={roadmap.id}>
                    <Image src="/icons/caret-right.svg" alt={t("components:roadmap_tree.show_source_alt")} width={24} height={24} className="round padding-25 margin-inline-25" />
                    <Link href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth' style={{ lineHeight: '1' }}>
                      <div>{`${roadmap.metaRoadmap.name} (v${roadmap.version})`}</div>
                      <div className={styles["roadmap-information"]}>{roadmap.metaRoadmap.type} • {t("components:roadmap_tree.goal_count", { count: roadmap._count.goals })}</div>
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
                <Image src="/icons/caret-right-gray.svg" alt={t("components:roadmap_tree.show_source_alt")} width="24" height="24" className="round padding-25 margin-inline-25" />
                <Link href={`/roadmap/${roadmap.id}`} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth' style={{ lineHeight: '1' }}>
                  <div>{`${roadmap.metaRoadmap.name} (v${roadmap.version})`}</div>
                  <div className={styles["roadmap-information"]}>{roadmap.metaRoadmap.type} • {t("components:roadmap_tree.goal_count", { count: roadmap._count.goals })}</div>
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