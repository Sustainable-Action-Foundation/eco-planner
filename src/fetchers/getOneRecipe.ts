import "server-only";
import { recipeSelector } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
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
  return getCachedRecipe(id, accessContext);
}

/**
 * Caches the specified recipe.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRecipe(id: string, accessContext: UserAccessContext | null): Promise<DBRecipe | null> {
  'use cache';
  cacheTag('database', 'recipe', 'dataSeries');

  let recipe: DBRecipe | null;
  try {
    recipe = await prisma.recipes.findUnique({
      where: {
        id,
        // Super admins may also fetch recipes not attached to any series (e.g. suggestion templates)
        ...(accessContext?.isSuperAdmin ? {} : { derived_data_series: visibleDataSeriesWHERE(accessContext) }),
      },
      select: recipeSelector,
    }) satisfies DBRecipe | null;
  }
  catch (err) {
    console.error("Error fetching recipe", { err });
    return null;
  }

  return recipe;
}
