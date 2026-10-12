'use server';

import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { uncachedFallback } from "@/fetchers/cacheFallback";
import { ActionFieldHeaders } from "@/functions/fields";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets every distinct action field header across the actions the user can see,
 * sorted alphabetically. TAG and DESCRIPTION are excluded since they are edited
 * through their own inputs rather than the free-form field rows.
 * Returns [] on error.
 */
export async function clientSafeGetAllFieldHeaders(): Promise<string[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => clientSafeGetCachedAllFieldHeaders(accessContext), [], "Error fetching field headers");
}

async function clientSafeGetCachedAllFieldHeaders(accessContext: UserAccessContext | null): Promise<string[]> {
  'use cache';
  cacheTag('database', 'action', 'roadmap', 'roadmapIteration');

  const fields: { header: string }[] = await prisma.actionFields.findMany({
    where: {
      header: { notIn: [ActionFieldHeaders.Tag, ActionFieldHeaders.Description] },
      action: visibleActionsWHERE(accessContext),
    },
    select: { header: true },
    distinct: ['header'],
  });

  return fields.map(field => field.header).sort((a, b) => a.localeCompare(b));
}
