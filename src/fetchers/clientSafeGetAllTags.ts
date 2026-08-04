'use server';

import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { ActionFieldHeaders } from "@/functions/actionFields";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets every distinct tag (the value of TAG-headed action fields) across the actions
 * the user can see, sorted alphabetically. Returns [] on error.
 */
export async function clientSafeGetAllTags(): Promise<string[]> {
  const accessContext = await getUserAccessContext();
  return clientSafeGetCachedAllTags(accessContext);
}

async function clientSafeGetCachedAllTags(accessContext: UserAccessContext | null): Promise<string[]> {
  'use cache';
  cacheTag('database', 'action');

  let fields: { value: string }[];
  try {
    fields = await prisma.actionFields.findMany({
      where: {
        header: ActionFieldHeaders.Tag,
        action: visibleActionsWHERE(accessContext),
      },
      select: { value: true },
      distinct: ['value'],
    });
  }
  catch (err) {
    console.error("Error fetching tags", { error: err });
    return [];
  }

  return fields.map(field => field.value).sort((a, b) => a.localeCompare(b));
}
