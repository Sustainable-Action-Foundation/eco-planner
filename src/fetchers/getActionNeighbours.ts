import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/** Just enough of an action to list it as a neighbour and spot drift from the origin */
const actionNeighbourSelection = {
  id: true,
  name: true,
  start_year: true,
  end_year: true,
  updated_at: true,
  origin_action_id: true,
  org: { select: { id: true, name: true, geo_area: { select: { code: true, name: true } } } },
  roadmap_iteration: { select: { id: true, version: true, roadmap: { select: { id: true, name: true } } } },
  fields: { select: { header: true, value: true }, orderBy: { order: 'asc' as const } },
} as const;

export type ActionNeighbour = Awaited<ReturnType<typeof prisma.actions.findMany<{ select: typeof actionNeighbourSelection }>>>[number];

/**
 * The other actions sharing this action's origin: the origin itself and every other copy
 * of it (or, for an origin, its copies). Only neighbours the user may see are returned, so
 * copies under draft or group-shared roadmaps stay hidden from outsiders.
 *
 * Returns an empty array for unlinked actions and on error.
 */
export async function getActionNeighbours(action: { id: string, origin_action_id: string | null }): Promise<ActionNeighbour[]> {
  const rootId = action.origin_action_id ?? action.id;
  const accessContext = await getUserAccessContext();
  return getCachedActionNeighbours(rootId, action.id, accessContext);
}

async function getCachedActionNeighbours(rootId: string, selfId: string, accessContext: UserAccessContext | null): Promise<ActionNeighbour[]> {
  'use cache';
  cacheTag('database', 'action');

  try {
    const neighbours = await prisma.actions.findMany({
      where: {
        AND: [
          { OR: [{ id: rootId }, { origin_action_id: rootId }] },
          { id: { not: selfId } },
          visibleActionsWHERE(accessContext),
        ],
      },
      select: actionNeighbourSelection,
      orderBy: [{ org: { name: 'asc' } }, { name: 'asc' }],
    });
    // The origin first, then the copies
    return neighbours.sort((a, b) => Number(b.id === rootId) - Number(a.id === rootId));
  }
  catch (err) {
    console.error(`Error fetching neighbours of action ${selfId}`, { err });
    return [];
  }
}
