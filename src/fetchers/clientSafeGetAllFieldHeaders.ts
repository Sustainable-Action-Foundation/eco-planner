'use server';

import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { ActionFieldHeaders } from "@/functions/actionFields";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets every distinct action field header across the actions the user can see,
 * sorted alphabetically. TAG is excluded since tags are edited separately.
 * Returns [] on error.
 */
export async function clientSafeGetAllFieldHeaders(): Promise<string[]> {
  const accessContext = await getUserAccessContext();
  return clientSafeGetCachedAllFieldHeaders(accessContext);
}

async function clientSafeGetCachedAllFieldHeaders(accessContext: UserAccessContext | null): Promise<string[]> {
  'use cache';
  cacheTag('database', 'action');

  let fields: { header: string }[];
  try {
    fields = await prisma.actionFields.findMany({
      where: {
        header: { not: ActionFieldHeaders.Tag },
        action: visibleActionsWHERE(accessContext),
      },
      select: { header: true },
      distinct: ['header'],
    });
  }
  catch (err) {
    console.error("Error fetching field headers", { error: err });
    return [];
  }

  return fields.map(field => field.header).sort((a, b) => a.localeCompare(b));
}
