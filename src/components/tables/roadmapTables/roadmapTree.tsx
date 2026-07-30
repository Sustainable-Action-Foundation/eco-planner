import "server-only";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { ControlsMenu } from "@/components/elements/controls/controls";
import accessChecker from "@/lib/accessChecker";
import type { MultiRoadmapInstance, UserAccessContext } from "@/types";
import Link from "next/link";
import { iterationPath } from "@/functions/versionSlug";
import { Fragment } from "react";
import serveTea from "@/lib/i18nServer";
import { IconCaretRightFilled, IconZoomQuestion } from "@tabler/icons-react";

type RoadmapTreeProps = {
  accessContext: UserAccessContext | null;
  iterations: MultiRoadmapInstance[];
};

/**
 * Renders given roadmap iterations in a tree structure. Iterations belonging to a roadmap without a(n accessible) parent are placed at the top level.
 * Other iterations are recursively nested under the current iteration based on their roadmap's parent_roadmap_id.
 *
 * Ignores which iterations work towards which other versions; only roadmap relationships are considered.
 */
export default async function RoadmapTree({
  iterations,
  accessContext,
}: RoadmapTreeProps) {
  const t = await serveTea("components");
  if (!iterations.length) {
    return (
      <div className="grid place-items-center">
        <IconZoomQuestion width={128} height={128} strokeWidth={1.25} />
        <p style={{width: 'min(60ch, 100%)', fontWeight: '500', textAlign: 'center'}}>{t("components:roadmap_tree.no_roadmaps")}</p> {/* TODO: I want to set font-size: 1.25rem; here but that causes the parent flexbox to wrap?? */}
      </div>
    );
  }

  const accessibleRoadmapIds = iterations.map(iteration => iteration.roadmap_id);

  // All iterations without a parent roadmap or with a parent roadmap the user does not have access to are placed at the top level
  const topLevelIterations = iterations.filter(iteration => (iteration.roadmap.parent_roadmap_id == null) || (!accessibleRoadmapIds.includes(iteration.roadmap.parent_roadmap_id)));

  return (
    <nav>
      <ul className={`${styles['roadmap-nav-ul']}`} style={{ paddingInlineStart: '0' }}>
        <NestedRoadmapRenderer
          allIterations={iterations}
          childIterations={topLevelIterations}
          accessContext={accessContext}
        />
      </ul>
    </nav>
  );
}

/**
 * Does the nesting of roadmap iterations for the `RoadmapTree` component.
 */
async function NestedRoadmapRenderer({
  allIterations,
  childIterations,
  accessContext,
}: {
  allIterations: RoadmapTreeProps['iterations'],
  childIterations: RoadmapTreeProps['iterations'],
  accessContext: RoadmapTreeProps['accessContext'],
}) {
  const t = await serveTea(["components", "common"]);
  return <>
    {childIterations.map(iteration => {
      let typeAlias = iteration.roadmap.type.toString();
      if (iteration.roadmap.type === "NATIONAL") typeAlias = t("common:scope.national");
      else if (iteration.roadmap.type === "REGIONAL") typeAlias = t("common:scope.regional");
      else if (iteration.roadmap.type === "MUNICIPAL") typeAlias = t("common:scope.municipal");
      else if (iteration.roadmap.type === "LOCAL") typeAlias = t("common:scope.local");
      else if (iteration.roadmap.type === "OTHER") typeAlias = t("common:scope.other");

      const accessLevel = accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext);
      const newChildIterations = allIterations.filter(potentialChild => (potentialChild.roadmap.parent_roadmap_id === iteration.roadmap_id) && (potentialChild.id !== iteration.id) && (potentialChild.roadmap.parent_roadmap_id != null));

      return (
        <Fragment key={`roadmap-tree-${iteration.id}`}>
          {newChildIterations.length > 0 ?
            <li>
              <details>
                {/* TODO: In accessibility tree, this shows as the link being labeled under "visa underliggande färdplaner" */}
                <summary className="flex justify-content-space-between" aria-label={t("components:roadmap_tree.show_source_alt")}>
                  <div className='inline-flex align-items-center flex-grow-100' key={iteration.id}>
                    <IconCaretRightFilled aria-hidden="true" className="round padding-25 margin-inline-25" />
                    <Link href={iterationPath(iteration.roadmap_id, iteration.version)} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth font-size-125' style={{ lineHeight: '1.1' }}>
                      {/* Name, version */}
                      <div>
                        {t("components:roadmap_tree.title", { name: iteration.roadmap.name, version: iteration.version })}
                      </div>
                      {/* Type, goal count */}
                      <div className="color-gray font-size-14px text-transform-lowercase font-weight-normal">
                        {typeAlias}
                        &nbsp;&middot;&nbsp;
                        {t("common:count.goal", { count: iteration._count.goals })}
                      </div>
                    </Link>
                  </div>
                  <span className="flex align-items-center padding-inline-25">
                    <ControlsMenu
                      accessLevel={accessLevel}
                      object={iteration}
                    />
                  </span>
                </summary>

                <ul className={styles['roadmap-nav-ul']}>
                  <NestedRoadmapRenderer
                    allIterations={allIterations}
                    childIterations={newChildIterations}
                    accessContext={accessContext}
                  />
                </ul>
              </details>
            </li>
            :
            <li className="inline-flex align-items-center flex-grow-100 width-100">
              <div className='inline-flex align-items-center flex-grow-100' key={iteration.id}>
                <IconCaretRightFilled aria-hidden="true" color="lightgray" className="round padding-25 margin-inline-25" />
                <Link href={iterationPath(iteration.roadmap_id, iteration.version)} className='flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth font-size-125' style={{ lineHeight: '1.1' }}>
                  {/* Name, version */}
                  <div>
                    {t("components:roadmap_tree.title", { name: iteration.roadmap.name, version: iteration.version })}
                  </div>
                  {/* Type, goal count */}
                  <div className="color-gray font-size-14px text-transform-lowercase font-weight-normal">
                    {typeAlias}
                    &nbsp;&middot;&nbsp;
                    {t("common:count.goal", { count: iteration._count.goals })}
                  </div>
                </Link>
              </div>
              <span className="flex align-items-center padding-inline-25">
                <ControlsMenu
                  accessLevel={accessLevel}
                  object={iteration}
                />
              </span>
            </li>
          }
        </Fragment>
      );
    })}
  </>;
}
