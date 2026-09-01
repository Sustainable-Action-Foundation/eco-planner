import "server-only";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { ControlsMenu } from "@/components/elements/controls/controls";
import accessChecker from "@/lib/accessChecker";
import type { MultiRoadmapInstance, UserAccessContext } from "@/types";
import Link from "next/link";
import { iterationPath } from "@/functions/versionSlug";
import { Fragment } from "react";
import serveTea from "@/lib/i18nServer";
import type { TFunction } from "i18next";
import { IconCaretRightFilled, IconPencil, IconZoomQuestion } from "@tabler/icons-react";

type RoadmapTreeProps = {
  accessContext: UserAccessContext | null;
  /** The versions to show: per roadmap its latest published one plus any drafts the user may see */
  iterations: MultiRoadmapInstance[];
};

/**
 * Splits the given versions into one node per roadmap (its latest published
 * version, or its newest draft when nothing is published) and the remaining
 * drafts, which nest under that node.
 */
function groupByRoadmap(iterations: MultiRoadmapInstance[]) {
  const byRoadmap = new Map<string, MultiRoadmapInstance[]>();
  for (const iteration of iterations) {
    byRoadmap.set(iteration.roadmap_id, [...(byRoadmap.get(iteration.roadmap_id) ?? []), iteration]);
  }

  const nodes: MultiRoadmapInstance[] = [];
  const draftsByRoadmap = new Map<string, MultiRoadmapInstance[]>();
  for (const [roadmapId, versions] of byRoadmap) {
    const newest = (candidates: MultiRoadmapInstance[]) => candidates.reduce((current, candidate) => candidate.version > current.version ? candidate : current);
    const published = versions.filter(version => version.published_at !== null);
    const node = published.length ? newest(published) : newest(versions);
    nodes.push(node);
    draftsByRoadmap.set(
      roadmapId,
      versions.filter(version => version.published_at === null && version.id !== node.id).sort((a, b) => b.version - a.version),
    );
  }
  // Keep the caller's ordering (they sort by the chosen criterion)
  nodes.sort((a, b) => iterations.indexOf(a) - iterations.indexOf(b));

  return { nodes, draftsByRoadmap };
}

/**
 * Renders roadmaps in a tree structure, one row per roadmap showing its latest published version.
 * Roadmaps without a(n accessible) parent are placed at the top level; the rest nest under their
 * parent roadmap. A roadmap's drafts (visible to editors only) come first among its children.
 *
 * Ignores which versions work towards which other versions; only roadmap relationships are considered.
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

  const { nodes, draftsByRoadmap } = groupByRoadmap(iterations);
  const accessibleRoadmapIds = nodes.map(node => node.roadmap_id);

  // All roadmaps without a parent roadmap or with a parent roadmap the user does not have access to are placed at the top level
  const topLevelNodes = nodes.filter(node => (node.roadmap.parent_roadmap_id == null) || (!accessibleRoadmapIds.includes(node.roadmap.parent_roadmap_id)));

  return (
    <nav>
      <ul className={`${styles['roadmap-nav-ul']}`} style={{ paddingInlineStart: '0' }}>
        <NestedRoadmapRenderer
          allNodes={nodes}
          childNodes={topLevelNodes}
          draftsByRoadmap={draftsByRoadmap}
          accessContext={accessContext}
        />
      </ul>
    </nav>
  );
}

function typeAliasFor(iteration: MultiRoadmapInstance, t: TFunction): string {
  switch (iteration.roadmap.type) {
    case "NATIONAL": {
      return t("common:scope.national");
    }
    case "REGIONAL": {
      return t("common:scope.regional");
    }
    case "MUNICIPAL": {
      return t("common:scope.municipal");
    }
    case "LOCAL": {
      return t("common:scope.local");
    }
    case "OTHER": {
      return t("common:scope.other");
    }
    case "ORGANIZATIONAL": {
      return t("common:scope.organizational");
    }
    default: {
      // Unknown values from the db are shown as-is
      const exhaustive: never = iteration.roadmap.type;
      return String(exhaustive);
    }
  }
}

/** The link + meta line for one version; drafts get a badge and green stripes. */
function IterationLink({ iteration, t }: { iteration: MultiRoadmapInstance, t: TFunction }) {
  const isDraft = iteration.published_at === null;
  return (
    <Link
      href={iterationPath(iteration.roadmap_id, iteration.version)}
      className={`flex-grow-100 padding-50 color-black text-decoration-none font-weight-500 smooth font-size-125 ${isDraft ? styles['draft-iteration'] : ''}`}
      style={{ lineHeight: '1.1' }}
      data-testid={isDraft ? "roadmap-tree-draft" : "roadmap-tree-version"}
    >
      {/* Name, version */}
      <div className="flex align-items-center gap-50 flex-wrap-wrap">
        {t("components:roadmap_tree.title", { name: iteration.roadmap.name, version: iteration.version })}
        {isDraft ?
          <span className="flex align-items-center gap-25 font-size-14px font-weight-500 padding-inline-50 round" style={{ backgroundColor: 'var(--seagreen)', color: 'white', lineHeight: '1.5' }}>
            <IconPencil aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />
            {t("components:roadmap_tree.draft")}
          </span>
          : null}
      </div>
      {/* Type, goal count */}
      <div className="color-gray font-size-14px text-transform-lowercase font-weight-normal">
        {typeAliasFor(iteration, t)}
        &nbsp;&middot;&nbsp;
        {t("common:count.goal", { count: iteration._count.goals })}
      </div>
    </Link>
  );
}

/**
 * Does the nesting of roadmaps for the `RoadmapTree` component.
 */
async function NestedRoadmapRenderer({
  allNodes,
  childNodes,
  draftsByRoadmap,
  accessContext,
}: {
  allNodes: MultiRoadmapInstance[],
  childNodes: MultiRoadmapInstance[],
  draftsByRoadmap: Map<string, MultiRoadmapInstance[]>,
  accessContext: RoadmapTreeProps['accessContext'],
}) {
  const t = await serveTea(["components", "common"]);
  return <>
    {childNodes.map(node => {
      const accessLevel = accessChecker({ access_control: node.roadmap.access_control, published_at: node.published_at }, accessContext);
      const drafts = draftsByRoadmap.get(node.roadmap_id) ?? [];
      const childRoadmapNodes = allNodes.filter(potentialChild => (potentialChild.roadmap.parent_roadmap_id === node.roadmap_id) && (potentialChild.id !== node.id) && (potentialChild.roadmap.parent_roadmap_id != null));

      return (
        <Fragment key={`roadmap-tree-${node.id}`}>
          {drafts.length > 0 || childRoadmapNodes.length > 0 ?
            <li>
              <details>
                {/* TODO: In accessibility tree, this shows as the link being labeled under "visa underliggande färdplaner" */}
                <summary className="flex justify-content-space-between" aria-label={t("components:roadmap_tree.show_source_alt")}>
                  <div className='inline-flex align-items-center flex-grow-100' key={node.id}>
                    <IconCaretRightFilled aria-hidden="true" className="round padding-25 margin-inline-25" />
                    <IterationLink iteration={node} t={t} />
                  </div>
                  <span className="flex align-items-center padding-inline-25">
                    <ControlsMenu
                      accessLevel={accessLevel}
                      object={node}
                    />
                  </span>
                </summary>

                <ul className={styles['roadmap-nav-ul']}>
                  {/* The roadmap's own drafts come first, then the roadmaps working towards it */}
                  {drafts.map(draft => (
                    <li key={`roadmap-tree-${draft.id}`} className="inline-flex align-items-center flex-grow-100 width-100">
                      <div className='inline-flex align-items-center flex-grow-100'>
                        <IconCaretRightFilled aria-hidden="true" color="lightgray" className="round padding-25 margin-inline-25" />
                        <IterationLink iteration={draft} t={t} />
                      </div>
                      <span className="flex align-items-center padding-inline-25">
                        <ControlsMenu
                          accessLevel={accessChecker({ access_control: draft.roadmap.access_control, published_at: draft.published_at }, accessContext)}
                          object={draft}
                        />
                      </span>
                    </li>
                  ))}
                  <NestedRoadmapRenderer
                    allNodes={allNodes}
                    childNodes={childRoadmapNodes}
                    draftsByRoadmap={draftsByRoadmap}
                    accessContext={accessContext}
                  />
                </ul>
              </details>
            </li>
            :
            <li className="inline-flex align-items-center flex-grow-100 width-100">
              <div className='inline-flex align-items-center flex-grow-100' key={node.id}>
                <IconCaretRightFilled aria-hidden="true" color="lightgray" className="round padding-25 margin-inline-25" />
                <IterationLink iteration={node} t={t} />
              </div>
              <span className="flex align-items-center padding-inline-25">
                <ControlsMenu
                  accessLevel={accessLevel}
                  object={node}
                />
              </span>
            </li>
          }
        </Fragment>
      );
    })}
  </>;
}
