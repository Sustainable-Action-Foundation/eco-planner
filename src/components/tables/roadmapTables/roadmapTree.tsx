import { TableMenu } from "@/components/tables/tableMenu/tableMenu.tsx";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { validateDict } from "@/functions/serverLocale";
import accessChecker from "@/lib/accessChecker.ts";
import { LoginData } from "@/lib/session.ts";
import { AccessControlled, Locale } from "@/types.ts";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import dict from "./roadmapTree.dict.json" assert { type: "json" };

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
  locale,
}: {
  roadmaps: RoadmapTreeProps['roadmaps'],
  user: RoadmapTreeProps['user'],
  locale: Locale,
}) {
  validateDict(dict);

  if (!roadmaps.length) {
    // const locale = getServerLocale();
    return <p>{dict.noRoadmaps[locale]}</p>;
  }

  const accessibleMetaRoadmaps = roadmaps.map(roadmap => roadmap.metaRoadmapId);

  // All roadmaps without a parent or with a parent the user does not have access to are placed at the top level
  const topLevelRoadmaps = roadmaps.filter(roadmap => (roadmap.metaRoadmap.parentRoadmapId == null) || (!accessibleMetaRoadmaps.includes(roadmap.metaRoadmap.parentRoadmapId)));

  return <ul className={styles.list}>
    <NestedRoadmapRenderer allRoadmaps={roadmaps} childRoadmaps={topLevelRoadmaps} user={user} locale={locale} />
  </ul>
}

/**
 * Does the nesting of roadmaps for the `RoadmapTree` component.
 */
function NestedRoadmapRenderer({
  allRoadmaps,
  childRoadmaps,
  user,
  locale,
}: {
  allRoadmaps: RoadmapTreeProps['roadmaps'],
  childRoadmaps: RoadmapTreeProps['roadmaps'],
  user: RoadmapTreeProps['user'],
  locale: Locale,
}) {
  // const locale = getServerLocale();
  return <>
    {childRoadmaps.map(roadmap => {
      const accessLevel = accessChecker(roadmap, user);
      const newChildRoadmaps = allRoadmaps.filter(potentialChild => (potentialChild.metaRoadmap.parentRoadmapId === roadmap.metaRoadmapId) && (potentialChild.id !== roadmap.id) && (potentialChild.metaRoadmap.parentRoadmapId != null));

      return <li key={`roadmap-tree-${roadmap.id}`}>
        <div className='flex gap-100 justify-content-space-between align-items-center' key={roadmap.id}>
          <a href={`/roadmap/${roadmap.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
            <span className={styles.linkTitle}>{`${roadmap.metaRoadmap.name} (v${roadmap.version})`}</span>
            <span className={styles.linkInfo}>{roadmap.metaRoadmap.type} • {roadmap._count.goals} {dict.nestedRoadmapRenderer.goals[locale]}</span>
          </a>
          <TableMenu
            accessLevel={accessLevel}
            object={roadmap}
          />
        </div>
        {newChildRoadmaps.length > 0 ?
          <ul className={styles.list}>
            <NestedRoadmapRenderer allRoadmaps={allRoadmaps} childRoadmaps={newChildRoadmaps} user={user} locale={locale} />
          </ul>
          : null
        }
      </li>
    })}
  </>
}