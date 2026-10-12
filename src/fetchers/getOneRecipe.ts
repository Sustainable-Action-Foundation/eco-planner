import "server-only";
import { recipeSelector } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleDataSeriesWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { DBRecipe, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified recipe, if the user can see the data series it produces
 * (visibility is derived from the series' goal/effect context).
 *
 * Returns null if the recipe is not found or user does not have access to it. Also returns null on error.
 */
export async function getOneRecipe(id: string): Promise<DBRecipe | null> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedRecipe(id, accessContext), null, "Error fetching recipe", { id });
}

/**
 * Caches the specified recipe.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRecipe(id: string, accessContext: UserAccessContext | null): Promise<DBRecipe | null> {
  'use cache';
  cacheTag('database', 'recipe', 'dataSeries');

  const recipe: DBRecipe | null = await prisma.recipes.findUnique({
    where: {
      id,
      // Super admins may also fetch recipes not attached to any series (e.g. suggestion templates)
      ...(accessContext?.isSuperAdmin ? {} : { derived_data_series: visibleDataSeriesWHERE(accessContext) }),
    },
    select: recipeSelector,
  }) satisfies DBRecipe | null;

  return recipe;
}
