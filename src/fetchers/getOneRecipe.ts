import "server-only";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { cookies } from "next/headers";
import type { DBRecipe } from "@/types";
import { recipeSelector } from "@/fetchers/inclusionSelectors";
import { cacheTag } from "next/dist/server/use-cache/cache-tag";

export async function getOneRecipe(id: string): Promise<DBRecipe | null> {
  const session = await getSession(await cookies());
  return getCachedRecipe(id, session.user);
}

/** TODO - use the accessChecker? that would require a full db read and then filter on the result, not a filtered query like this is */
const roadmapAccessFilter = (userId: string) => ({
  OR: [
    { isPublic: true },
    { authorId: userId },
    { editors: { some: { id: userId } } },
    { viewers: { some: { id: userId } } },
    { editGroups: { some: { users: { some: { id: userId } } } } },
    { viewGroups: { some: { users: { some: { id: userId } } } } },
  ],
});

async function getCachedRecipe(id: string, user: LoginData['user']): Promise<DBRecipe | null> {
  'use cache';
  cacheTag('database', 'recipe', 'dataSeries');

  let recipe: DBRecipe | null;

  // If user is admin, always get the recipe
  if (user?.isAdmin) {
    try {
      recipe = await prisma.recipe.findUnique({
        where: { id },
        select: recipeSelector,
      }) satisfies DBRecipe | null;
      if (!recipe) {
        return null;
      }
    }
    catch (error) {
      console.error("Error fetching recipe as admin", { error });
      return null;
    }

    return recipe;
  }

  // If user is logged in, get the recipe if they have access to it
  if (user?.isLoggedIn) {
    try {
      // Where recipe id, and user has access to anything using the data series' using this recipe
      recipe = await prisma.recipe.findUnique({
        where: {
          id,
          derivedDataSeries: {
            some: {
              OR: [
                {
                  dependentGoals: {
                    some: {
                      OR: [
                        { authorId: user.id },
                        { roadmap: roadmapAccessFilter(user.id) },
                      ],
                    },
                  },
                },
                {
                  dependentEffects: {
                    some: {
                      OR: [
                        { goal: { authorId: user.id } },
                        { goal: { roadmap: roadmapAccessFilter(user.id) } },
                      ],
                    },
                  },
                },
                {
                  dependentBaselines: {
                    some: {
                      OR: [
                        { roadmap: roadmapAccessFilter(user.id) },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      });
      if (!recipe) {
        return null;
      }
    }
    catch (error) {
      console.error("Error fetching recipe as user", { error });
      return null;
    }

    return recipe;
  }

  // If user is not logged in, get the recipe if it is public
  try {
    recipe = await prisma.recipe.findUnique({
      where: {
        id,
        derivedDataSeries: {
          some: {
            OR: [
              {
                dependentGoals: {
                  some: {
                    roadmap: { isPublic: true },
                  },
                },
              },
              {
                dependentEffects: {
                  some: {
                    goal: {
                      roadmap: { isPublic: true },
                    },
                  },
                },
              },
              {
                dependentBaselines: {
                  some: {
                    roadmap: { isPublic: true },
                  },
                },
              },
            ],
          },
        },
      },
    });
    if (!recipe) {
      return null;
    }
  }
  catch (error) {
    console.error("Error fetching public recipe", { error });
    return null;
  }

  return recipe;
}