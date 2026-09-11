'use server';

import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

export type ActionOption = {
  id: string;
  name: string;
  orgName: string;
  originActionId: string | null;
  roadmapName: string | null;
};

/**
 * The actions the user can see, reduced to what a picker needs (e.g. choosing an
 * action's origin). Returns [] on error.
 */
export async function clientSafeGetActionOptions(): Promise<ActionOption[]> {
  const accessContext = await getUserAccessContext();
  return clientSafeGetCachedActionOptions(accessContext);
}

async function clientSafeGetCachedActionOptions(accessContext: UserAccessContext | null): Promise<ActionOption[]> {
  'use cache';
  cacheTag('database', 'action');

  try {
    const actions = await prisma.actions.findMany({
      where: visibleActionsWHERE(accessContext),
      select: {
        id: true,
        name: true,
        origin_action_id: true,
        org: { select: { name: true } },
        roadmap_iteration: { select: { roadmap: { select: { name: true } } } },
      },
      orderBy: [{ org: { name: 'asc' } }, { name: 'asc' }],
    });
    return actions.map(action => ({
      id: action.id,
      name: action.name,
      orgName: action.org.name,
      originActionId: action.origin_action_id,
      roadmapName: action.roadmap_iteration?.roadmap.name ?? null,
    }));
  }
  catch (err) {
    console.error("Error fetching action options", { error: err });
    return [];
  }
}
