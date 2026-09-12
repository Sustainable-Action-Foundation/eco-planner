import { getActionNeighbours } from "@/fetchers";
import { actionContentDiffers } from "@/functions/fields";
import { iterationPath } from "@/functions/versionSlug";
import serveTea from "@/lib/i18nServer";
import type { Action } from "@/types";
import { IconArrowNarrowRight, IconGitBranch } from "@tabler/icons-react";
import Link from "next/link";

/**
 * Lists the other actions sharing this action's origin: the original (typically the
 * municipality's catalogue entry) and the other orgs' copies of it. Copies that have
 * drifted from the original are marked, which is the seed of the future sync offer.
 * Renders nothing for actions without neighbours.
 */
export default async function ActionNeighbours({ action }: { action: Action }) {
  const [t, neighbours] = await Promise.all([
    serveTea("pages"),
    getActionNeighbours(action),
  ]);
  if (neighbours.length === 0) return null;

  const rootId = action.origin_action_id ?? action.id;
  const origin = neighbours.find(neighbour => neighbour.id === rootId);
  // Drift is measured against the origin: for a copy, its own drift; for the origin, each copy's
  const selfDiffers = origin ? actionContentDiffers(action, origin) : false;

  return (
    <section className="margin-block-300" data-testid="action-neighbours">
      <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:action.neighbours_label")}</h2>
      <p className="margin-block-50" style={{ color: 'gray' }}>
        {origin
          ? t("pages:action.neighbours_copy_description", { origin: origin.org.name })
          : t("pages:action.neighbours_origin_description", { count: neighbours.length })}
        {selfDiffers ? ` ${t("pages:action.neighbours_self_differs")}` : null}
      </p>
      <ul className="padding-0 margin-0" style={{ listStyle: 'none' }}>
        {neighbours.map(neighbour => {
          const isOrigin = neighbour.id === rootId;
          // Copies are compared to the origin; when viewing the origin every copy is compared to this action
          const differs = isOrigin ? selfDiffers : actionContentDiffers(neighbour, origin ?? action);
          return (
            <li key={neighbour.id} className="smooth padding-50 margin-bottom-25" style={{ border: '1px solid var(--gray-80)' }}>
              <Link href={`/action/${neighbour.id}`} className="discrete-link flex align-items-center gap-50 flex-wrap-wrap">
                <IconGitBranch aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                <span className="font-weight-500">{neighbour.org.name}</span>
                {isOrigin ?
                  <span className="smooth padding-inline-25 font-size-14px" style={{ backgroundColor: 'var(--seagreen-90)', border: '1px solid var(--seagreen-80)', color: 'var(--seagreen-30)' }}>
                    {t("pages:action.neighbour_origin_badge")}
                  </span>
                  : null}
                {neighbour.roadmap_iteration ?
                  <span className="font-size-14px" style={{ color: 'gray' }}>
                    {`${neighbour.roadmap_iteration.roadmap.name} (v${neighbour.roadmap_iteration.version})`}
                  </span>
                  : null}
                {differs ?
                  <span className="font-size-14px" style={{ color: 'var(--brown-30)' }} data-testid="action-neighbour-differs">
                    {t("pages:action.neighbour_differs")}
                  </span>
                  : null}
                <span className="flex-grow-100" />
                <span className="flex align-items-center gap-25 font-size-14px">
                  {neighbour.name !== action.name ? neighbour.name : t("pages:action.visit_neighbour")}
                  <IconArrowNarrowRight width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
                </span>
              </Link>
              {neighbour.roadmap_iteration ?
                <Link href={iterationPath(neighbour.roadmap_iteration.roadmap.id, neighbour.roadmap_iteration.version)} className="font-size-14px" style={{ color: 'gray' }}>
                  {neighbour.roadmap_iteration.roadmap.name}
                </Link>
                : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
